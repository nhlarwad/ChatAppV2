const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

let storage=new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "Neutron",
        allowedFormats: ["jpeg", "png", "jpg"]
    }
});

// module.exports={cloudinary, storage};
module.exports.cloudinary=cloudinary;
module.exports.storage=storage;