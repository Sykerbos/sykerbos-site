export const PLANT_ASSETS = {
  rosemary: {
    names: ['rosemary','salvia rosmarinus','rosmarinus officinalis'],
    image: 'assets/hero/rosemary-vytile.png',
    sourcePage: 'local Sykerbos prototype photo',
    license: 'Sykerbos project asset',
    dossier: 'herbarium-rosemary.html'
  },
  basil: {
    names: ['basil','ocimum basilicum'],
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Ocimum_Basilicum.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Ocimum_Basilicum.jpg',
    license: 'Public domain',
    dossier: 'herbarium-basil.html'
  },
  thyme: {
    names: ['thyme','thymus vulgaris'],
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Thymus_vulgaris_Kohler_DESC.png',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Thymus_vulgaris_Kohler_DESC.png',
    license: 'Public domain',
    dossier: 'herbarium-thyme.html'
  },
  mint: {
    names: ['mint','peppermint','mentha × piperita','mentha x piperita'],
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mentha_Piperita.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Mentha_Piperita.jpg',
    license: 'Public domain',
    dossier: 'herbarium-mint.html'
  },
  oregano: {
    names: ['oregano','origanum vulgare'],
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Illustration_Origanum_vulgare0.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Illustration_Origanum_vulgare0.jpg',
    license: 'Public domain',
    dossier: 'herbarium-oregano.html'
  },
  valenciaOrange: {
    names: ['valencia orange','orange seedling','citrus × sinensis','citrus x sinensis','citrus sinensis'],
    image: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Pomological_Watercolor_POM00000265.jpg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Pomological_Watercolor_POM00000265.jpg',
    license: 'Public domain',
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
