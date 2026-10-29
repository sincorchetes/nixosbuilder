// disko.nix de los esquemas predefinidos.
import { indent, indentTail, nixList, nixString } from './nix';
import type { NixBuilderConfig } from './types';

/* ------------------------------- Discos ------------------------------- */

export const fsContent = (filesystem: 'ext4' | 'xfs' | 'btrfs', discard: boolean, mountpoint = '/') => {
  if (filesystem === 'btrfs') {
    const options = nixList(['compress=zstd', 'noatime', ...(discard ? ['discard=async'] : [])]);
    const subvolume = (name: string, path: string) =>
      `    ${nixString(name)} = {\n      mountpoint = ${nixString(path)};\n      mountOptions = ${options};\n    };`;
    return `{
  type = "btrfs";
  extraArgs = [ "-f" ];
  subvolumes = {
${subvolume('@', mountpoint)}
${subvolume('@home', '/home')}
${subvolume('@nix', '/nix')}
  };
}`;
  }
  return `{
  type = "filesystem";
  format = ${nixString(filesystem)};
  mountpoint = ${nixString(mountpoint)};${discard ? '\n  mountOptions = [ "discard" ];' : ''}
}`;
};

export const generateDisko = (config: NixBuilderConfig) => {
  const { diskScheme: scheme, encryption, discard } = config;
  const extras: string[] = [];
  let rootContent: string;

  if (scheme === 'zfs') {
    rootContent = '{\n  type = "zfs";\n  pool = "zroot";\n}';
    const dataset = (path: string) =>
      `    ${path === '/' ? 'root' : path.slice(1)} = {\n      type = "zfs_fs";\n      mountpoint = ${nixString(path)};\n      options.mountpoint = "legacy";\n    };`;
    extras.push(`zpool.zroot = {
  type = "zpool";
  options = {
    ashift = "12";${discard ? '\n    autotrim = "on";' : ''}
  };
  rootFsOptions = {
    compression = "zstd";
    acltype = "posixacl";
    xattr = "sa";
    mountpoint = "none";${encryption ? '\n    encryption = "aes-256-gcm";\n    keyformat = "passphrase";\n    keylocation = "prompt";' : ''}
  };
  datasets = {
${['/', '/nix', '/home'].map(dataset).join('\n')}
  };
};`);
  } else {
    let inner: string;
    if (scheme === 'lvm') {
      inner = '{\n  type = "lvm_pv";\n  vg = "pool";\n}';
      extras.push(`lvm_vg.pool = {
  type = "lvm_vg";
  lvs.root = {
    size = "100%FREE";
    content = ${indentTail(fsContent(config.lvmFilesystem, discard), 4)};
  };
};`);
    } else {
      inner = fsContent(scheme, discard);
    }
    rootContent = encryption
      ? `{
  type = "luks";
  name = "cryptroot";${discard ? '\n  settings.allowDiscards = true;' : ''}
  content = ${indentTail(inner, 2)};
}`
      : inner;
  }

  return `{ ... }:
{
  disko.devices = {
    disk.main = {
      device = ${nixString(config.diskDevice)};
      type = "disk";
      content = {
        type = "gpt";
        partitions = {
          ESP = {
            size = "1G";
            type = "EF00";
            content = {
              type = "filesystem";
              format = "vfat";
              mountpoint = "/boot";
              mountOptions = [ "umask=0077" ];
            };
          };
          root = {
            size = "100%";
            content = ${indentTail(rootContent, 12)};
          };
        };
      };
    };
${extras.map((extra) => indent(extra, 4)).join('\n')}
  };
}
`;
};
