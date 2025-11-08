const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary configurado com sucesso!');

// === PASTA: NOTÍCIAS (SEU ORIGINAL) ===
const storageNoticias = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'rpa_noticias',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
  },
});

// === PASTA: ANÚNCIOS (NOVO) ===
const storageAnuncios = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'rpa_anuncios',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

console.log('Storages criados: rpa_noticias e rpa_anuncios');

module.exports = { 
  cloudinary, 
  storageNoticias, 
  storageAnuncios 
};