// UI artwork only. API map IDs, radar URLs and coordinate versions stay unchanged.
// Source snapshot, ownership and per-file hashes: public/maps/icons/ATTRIBUTION.md.
const mapLogos: Record<string, string> = {
  mirage: "/maps/icons/mirage.png",
  inferno: "/maps/icons/inferno.png",
  ancient: "/maps/icons/ancient.png",
  cache: "/maps/icons/cache.png",
  nuke: "/maps/icons/nuke.png",
  dust2: "/maps/icons/dust2.png",
  anubis: "/maps/icons/anubis.png",
};

export function mapLogoUrl(mapId: string): string | undefined {
  return Object.hasOwn(mapLogos, mapId) ? mapLogos[mapId] : undefined;
}
