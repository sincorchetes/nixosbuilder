import { describe, expect, test } from 'bun:test';
import {
  defaultLayout,
  formatSize,
  generateDiskoLayout,
  generateFilesystemsNix,
  generatePartitionScript,
  layoutBytes,
  layoutFromLsblk,
  newPartition,
  parseLsblk,
  parseSize,
  validateLayout,
} from '../src/lib/disk';

const LSBLK = `NAME          SIZE TYPE  FSTYPE      UUID                                 MOUNTPOINTS ROTA
nvme0n1     476.9G disk                                                                0
├─nvme0n1p1   512M part  vfat        ABCD-1234                            /boot          0
├─nvme0n1p2   100G part  ntfs        0123456789ABCDEF                                    0
└─nvme0n1p3 376.4G part  crypto_LUKS 5f0c2d6e-1111-2222-3333-444455556666                0
  └─cryptroot 376.4G crypt ext4      aaaaaaaa-1111-2222-3333-444455556666 /              0
sda         931.5G disk                                                                1
└─sda1      931.5G part  ext4        bbbbbbbb-1111-2222-3333-444455556666 /data          1
zram0           4G disk                                                  [SWAP]       0
loop0         100M loop                                                  /snap/x      0`;

describe('sizes', () => {
  test.each([
    ['512M', 512 * 1024 ** 2],
    ['1G', 1024 ** 3],
    ['476,9G', Math.round(476.9 * 1024 ** 3)],
    ['2T', 2 * 1024 ** 4],
  ])('parseSize(%s)', (text, bytes) => {
    expect(parseSize(text)).toBe(bytes);
  });
  test('invalid text gives 0', () => expect(parseSize('mucho')).toBe(0));
  test('formatSize rounds to a readable unit', () => {
    expect(formatSize(1024 ** 3)).toBe('1G');
    expect(formatSize(512 * 1024 ** 2)).toBe('512M');
    expect(formatSize(0)).toBe('?');
  });
  test('100% takes what is left of the disk', () => {
    const parts = [newPartition('esp'), newPartition('root')];
    const bytes = layoutBytes(parts, 100 * 1024 ** 3);
    expect(bytes[0]).toBe(1024 ** 3);
    expect(bytes[1]).toBe(99 * 1024 ** 3);
  });
});

describe('reading lsblk', () => {
  const disks = parseLsblk(LSBLK);

  test('detects disks and drops loop and zram', () => {
    expect(disks.map((disk) => disk.device)).toEqual(['/dev/nvme0n1', '/dev/sda']);
  });
  test('reads size, drive type and partitions', () => {
    expect(disks[0].partitions).toHaveLength(3);
    expect(disks[0].rotational).toBe(false);
    expect(disks[1].rotational).toBe(true);
    expect(disks[0].bytes).toBeGreaterThan(400 * 1024 ** 3);
  });
  test('the mount point does not drag along the ROTA column', () => {
    expect(disks[0].partitions[0].mountpoint).toBe('/boot');
    expect(disks[1].partitions[0].mountpoint).toBe('/data');
  });
  test('ties the decrypted volume to its LUKS partition', () => {
    const luks = disks[0].partitions[2];
    expect(luks.fstype).toBe('crypto_LUKS');
    expect(luks.child).toEqual({ fstype: 'ext4', mountpoint: '/' });
  });
  test('text without disks gives an empty list', () => expect(parseLsblk('hola mundo')).toEqual([]));
  test('works without a ROTA header (plain lsblk)', () => {
    const plain = parseLsblk('NAME   SIZE TYPE MOUNTPOINTS\nsda     50G disk\n└─sda1  50G part /');
    expect(plain[0].partitions[0].mountpoint).toBe('/');
  });
  test('layoutFromLsblk marks everything as existing and respects LUKS', () => {
    const layout = layoutFromLsblk(disks[0]);
    expect(layout.every((part) => !!part.existing)).toBe(true);
    expect(layout[0]).toMatchObject({ fs: 'vfat', mountpoint: '/boot', encrypt: false });
    expect(layout[1]).toMatchObject({ fs: 'none', mountpoint: '' });
    expect(layout[2]).toMatchObject({ fs: 'ext4', mountpoint: '/', encrypt: true });
  });
});

describe('layout validation', () => {
  const check = (parts: ReturnType<typeof defaultLayout>, extra = {}) =>
    validateLayout(parts, { device: '/dev/sda', diskBytes: 0, disko: false, ...extra });

  test('the default layout is valid', () => expect(check(defaultLayout())).toEqual({ errors: [], warnings: [] }));
  test('requires a root', () => {
    expect(check([newPartition('esp')]).errors.join()).toMatch(/raíz/);
  });
  test('duplicate or invalid names, sizes and mounts', () => {
    const a = { ...newPartition('root'), name: 'x', size: '5G' };
    const errors = check([
      a,
      { ...a, id: 'b', mountpoint: '/' },
      { ...newPartition('data'), name: 'mal nombre', size: '5X', mountpoint: 'sin-barra' },
    ]).errors.join('\n');
    expect(errors).toMatch(/repetido: x/);
    expect(errors).toMatch(/Nombre de partición no válido/);
    expect(errors).toMatch(/Tamaño no válido/);
    expect(errors).toMatch(/Punto de montaje repetido: \//);
    expect(errors).toMatch(/Punto de montaje no válido/);
  });
  test('only the last one can be 100%', () => {
    const first = { ...newPartition('root') };
    expect(check([first, { ...newPartition('data'), size: '10G' }]).errors.join()).toMatch(/Solo la última/);
  });
  test('the ESP is not encrypted and swap/unformatted are not mounted', () => {
    const esp = { ...newPartition('esp'), encrypt: true };
    const swap = { ...newPartition('swap'), mountpoint: '/x' };
    const errors = check([esp, swap, newPartition('root')]).errors.join('\n');
    expect(errors).toMatch(/ESP .*no puede cifrarse/);
    expect(errors).toMatch(/no puede tener punto de montaje/);
  });
  test('warns if FAT32 /boot is missing or if they add up to more than the disk', () => {
    const noBoot = check([newPartition('root')]);
    expect(noBoot.warnings.join()).toMatch(/\/boot/);
    const big = check(
      [
        { ...newPartition('esp'), size: '200G' },
        { ...newPartition('root'), size: '50G' },
      ],
      { diskBytes: 100 * 1024 ** 3 },
    );
    expect(big.warnings.join()).toMatch(/suman/);
  });
  test('disko cannot keep existing partitions', () => {
    const existing = layoutFromLsblk(parseLsblk(LSBLK)[1]);
    expect(check(existing, { disko: true }).errors.join()).toMatch(/disko no puede conservar/);
    expect(check(existing, { disko: false }).errors.join()).not.toMatch(/disko no puede conservar/);
  });
  test('invalid device', () => expect(check(defaultLayout(), { device: 'sda' }).errors.join()).toMatch(/ruta de dispositivo/));
});

describe('generation', () => {
  const layout = [newPartition('esp'), newPartition('swap'), { ...newPartition('root'), encrypt: true }];

  test('disko.nix: ordered partitions, GPT types, swap and LUKS', () => {
    const nix = generateDiskoLayout('/dev/nvme0n1', layout, true);
    expect(nix).toContain('device = "/dev/nvme0n1"');
    expect(nix).toContain('type = "EF00"');
    expect(nix).toContain('type = "8200"');
    expect(nix).toContain('type = "luks"');
    expect(nix).toContain('name = "crypt-root"');
    expect(nix).toContain('discardPolicy = "both"');
    expect(nix.indexOf('priority = 100;')).toBeLessThan(nix.indexOf('priority = 200;'));
  });
  test('disko.nix without discard does not ask for allowDiscards', () => {
    expect(generateDiskoLayout('/dev/sda', layout, false)).not.toContain('allowDiscards');
  });
  test('script: creates, encrypts, formats and mounts in order', () => {
    const script = generatePartitionScript('/dev/vda', layout);
    expect(script.startsWith('#!/usr/bin/env bash')).toBe(true);
    expect(script).toContain('sgdisk --zap-all "$DISK"');
    expect(script).toContain('sgdisk -n 0:0:+1G -t 0:EF00 -c 0:esp');
    expect(script).toContain('sgdisk -n 0:0:0 -t 0:8309 -c 0:root');
    expect(script).toContain('cryptsetup luksFormat /dev/disk/by-partlabel/root');
    expect(script).toContain('mkfs.btrfs -f -L root /dev/mapper/crypt-root');
    expect(script.indexOf('mount --mkdir /dev/mapper/crypt-root /mnt\n')).toBeLessThan(script.indexOf('/mnt/boot'));
    expect(script).toContain('swapon');
  });
  test('a script with existing partitions does not wipe the disk or format them', () => {
    const kept = layoutFromLsblk(parseLsblk(LSBLK)[0]);
    const script = generatePartitionScript('/dev/nvme0n1', [...kept, { ...newPartition('data'), size: '10G' }]);
    expect(script).not.toContain('--zap-all');
    expect(script).toContain('cryptsetup open /dev/disk/by-uuid/5f0c2d6e');
    expect(script).not.toContain('luksFormat');
    expect(script).not.toContain('mkfs.fat');
    expect(script).toContain('mkfs.ext4 -L data');
  });
  test('filesystems.nix: LUKS, mounts and swap', () => {
    const nix = generateFilesystemsNix(layout, true);
    expect(nix).toContain('boot.initrd.luks.devices."crypt-root"');
    expect(nix).toContain('fileSystems."/boot"');
    expect(nix).toContain('fsType = "vfat"');
    expect(nix).toContain('device = "/dev/mapper/crypt-root"');
    expect(nix).toContain('swapDevices');
  });
  test('is deterministic', () => {
    expect(generateDiskoLayout('/dev/sda', layout, true)).toBe(generateDiskoLayout('/dev/sda', structuredClone(layout), true));
  });
});
