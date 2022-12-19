require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Deta } = require('deta');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const { Duplex } = require('stream');
const jsmediatags = require('jsmediatags');


const port = process.env.PORT;
const pass = process.env.PASS;
const key = process.env.DETA_PROJECT_KEY;

const app = express();
const deta = Deta(key);
const Drive = deta.Drive('songs');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let nameOfFile;

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "audios/");
    },
    filename: (req, file, cb) => {

        const ext = "mp3";
        nameOfFile = file.originalname;
        cb(null, `musicFile.${ext}`);
    },
});

const upload = multer({
    storage: multerStorage,
});

function connectMongo() {
    try {
        mongoose.connect(`mongodb+srv://dugu_music:${pass}@cluster0.ceyorwz.mongodb.net/?retryWrites=true&w=majority`, { useNewUrlParser: true })
            .catch(err => {
                if (err) console.log("Error while connecting to mongoDb ::: ", err);
            });
    } catch (error) {
        console.log("Error while connecting to mongoDb : ", Error);
    }
}

const musicSchema = new mongoose.Schema({
    name: String,
    description: String,
    singer: String,
    songId: String
});

const Music = mongoose.model('MusicData', musicSchema);

app.post("/insert-data", upload.single("file"), async (req, res) => {

    try {
        let { name, description, singer } = req.body;
        let filename = Date.now();


        fs.readFile('./audios/musicFile.mp3', 'binary', async function (err, data) {
            if (err) console.log("Error : ", err);

            const result = await Drive.put(filename.toString(), { data: data });

            if (result) {
                let music = new Music({
                    name,
                    description,
                    singer,
                    songId: filename
                });
                music.save();
                fs.unlink('audios/musicFile.mp3', (err) => {
                    if (err) console.log(err);
                    res.status(200).send({ data: "Success" });
                });
            } else {
                res.status(500).send({ data: "Error occured!" });
            }
        });

    } catch (error) {
        console.log("Error : ", error);
        res.status(500).send("Internal server error.");
    }
});

app.get("/music-data", (req, res) => {
    try {
        Music.find((err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send({
                    data: "Error while fetching data."
                })
            }

            res.status(200).send({
                data: result
            })
        })
    } catch (error) {
        res.status(500).send({
            data: "Internal server error."
        })
    }

});

app.get("/song-details/:songId", (req, res) => {
    try {
        const songId = req.params.songId;
        console.log(songId);

        Music.find({ songId }, (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send({
                    data: "Error occured while fetching data."
                })
            }
            console.log(result[0]);
            res.status(200).send({
                data: result[0]
            })
        })
    } catch (error) {
        res.status(500).send({
            data: "Internal server error."
        })
    }

});

app.get("/song/:songId", async (req, res) => {
    try {
        const songId = req.params.songId;
        const song = await Drive.get(songId);
        if (song) {
            const buffer = await song.arrayBuffer();
            const readStream = new Duplex();
            readStream.push(Buffer.from(buffer));
            readStream.push(null);
            res.writeHead(200);
            readStream.pipe(res);
        } else {
            res.status(404).send({ data: "data not found !" });
        }

    } catch (error) {
        res.status(500).send({
            data: "Internal server error."
        });
    }
});

app.get("/get-image/:songId", async (req, res) => {
    try {
        const songId = req.params.songId;
        const song = await Drive.get(songId);
        console.log("Song  : ", song);
        const buffer = await song.arrayBuffer();
        let base64String;
        if (song) {
            jsmediatags.read(Buffer.from(buffer), {
                onSuccess: (tag) => {
                    let data = tag.tags.picture.data;
                    let format = tag.tags.picture.format;

                    console.log("tag : ", data);

                    // for (let i = 0; i < data.length; i++) {
                    //     base64String += String.fromCharCode(data[i])
                    // }

                    // console.log("base64String :   ",base64String);
                    res.status(200).send({
                        data: {
                            imageData: data,
                            format: format
                        }
                    });
                },
                onError: function (error) {
                    console.log(error)
                }
            });
        } else {
            res.status(404).send({ data: "data not found !" });
        }
    } catch (error) {
        res.status(404).send({ data: "data not found !" });

    }

});

app.listen(port, () => {
    console.log(`Listning on ${port}`);
    connectMongo();
});
