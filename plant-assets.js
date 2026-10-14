export const PLANT_ASSETS = {
  rosemary: {
    names: ['rosemary','salvia rosmarinus','rosmarinus officinalis'],
    image: 'assets/plants/rosemary.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-rosemary.html'
  },
  basil: {
    names: ['basil','ocimum basilicum'],
    image: 'assets/plants/basil.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-basil.html'
  },
  thyme: {
    names: ['thyme','thymus vulgaris'],
    image: 'assets/plants/thyme.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-thyme.html'
  },
  mint: {
    names: ['mint','peppermint','mentha × piperita','mentha x piperita'],
    image: 'assets/plants/mint.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-mint.html'
  },
  oregano: {
    names: ['oregano','origanum vulgare'],
    image: 'assets/plants/oregano.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-oregano.html'
  },
  valenciaOrange: {
    names: ['valencia orange','orange seedling','citrus × sinensis','citrus x sinensis','citrus sinensis'],
    image: 'assets/plants/valencia-orange-seedling.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-orange.html'
  },
  peaceLily: {
    names: ['peace lily','spathiphyllum'],
    image: 'assets/plants/peace-lily.png',
    sourcePage: 'Sykerbos generated Herbarium asset',
    license: 'Sykerbos project asset',
    dossier: null
  }
};

export function plantAssetFor(plant = {}) {
  const haystack = [plant.common_name, plant.botanical_name, plant.nickname]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return Object.values(PLANT_ASSETS).find(asset =>
    asset.names.some(name => haystack.includes(name.toLowerCase()))
  ) || null;
}
