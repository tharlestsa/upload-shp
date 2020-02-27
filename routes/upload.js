
const express      = require('express');
const multer       = require('multer');
const unzipper     = require('unzipper');
const fs           = require('fs');
const ogr2ogr      = require('ogr2ogr')
const childProcess = require('child_process'); 
const router       = express.Router();


const appRoot = require('app-root-path');
const dir_upload = appRoot + '/public/uploads'; 

const upload = multer({ dest: dir_upload});

const targetFilesName =  Math.floor(Date.now()); 

/** Permissible loading a single file, 
    the value of the attribute "name" in the form of "shapefile". **/
const type = upload.single('shapefile');



router.post('/shp', type, function (req, res) {

  const clearCache = function (data, callback) {

    let fname = targetFilesName; 

    fs.readdir(dir_upload, (err, files) => {
        files = files.filter(file => file.includes(fname));
        let len = files.length;
        for(const file of files){ 
            fs.unlink(dir_upload + "/" + file, err => {
              console.log(file, "deleted"); 
                if(--len <= 0){
                    callback(true, data);
                }
            });  
        }
    });
  }


  const toGeoJson =  function(shapfile, callback){
      // Use options ["--config", "SHAPE_RESTORE_SHX", "TRUE"] to recreate the shx file if it doesn't exist
    let geojson = ogr2ogr(shapfile).timeout(300000); // 5 minutes

    geojson.exec(function(er, data) {
      if (er) console.error(er)
      callback(data, finish);
    })

  }; 

  const extratFiles = function (zip, callback){
    (async () => {
      try{

        for await (const entry of zip) {
            const fileName  = entry.path;
            const type      = entry.type; // 'Directory' or 'File'
            const size      = entry.vars.uncompressedSize; // There is also compressedSize;

            let isShp = fileName.split('.').pop() == 'shp' ? true : false;
            let isShx = fileName.split('.').pop() == 'shx' ? true : false;

          
            if ((isShp || isShx) && type == "File") {

                let dest = dir_upload +"/"+ targetFilesName +"." + fileName.split('.').pop(); 
                entry.pipe(fs.createWriteStream(dest));

            } else {

                entry.autodrain();

            }
        }

      }catch(e){

        console.log(e.stack);

      }
      
      callback(dir_upload +"/"+ targetFilesName +".shp", clearCache);

    })();
  }; 


  /** When using the "single"
      data come in "req.file" regardless of the attribute "name". **/
  const tmp_path = req.file.path;

  /** The original name of the uploaded file
      stored in the variable "originalname". **/
  // const target_path = dir_upload + "/" + req.file.originalname;


  // /** A better way to copy the uploaded file. **/
  const src  = fs.createReadStream(tmp_path);
  // // const dest = fs.createWriteStream(target_path);

  const zip = src.pipe(unzipper.Parse({forceStream: true}));

  extratFiles(zip, toGeoJson);

  fs.unlinkSync(tmp_path);

  const finish =  function(finished, geoJson){
    if(finished){
        res.render('index', {title:"Your map was uploaded" ,geojson: JSON.stringify(geoJson)}); 
    }
  }; 
  

});



module.exports = router;
