console.log("SON VERSION CALISIYOR");

const express = require("express");
const fileUpload = require("express-fileupload");
const QRCode = require("qrcode");
const os = require("os");
const fs = require("fs");

const app = express();

app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 * 1024 }
}));

function getIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}

const ip = getIP() || "localhost";
const url = "http://" + ip + ":3000";

app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>
      body {
        margin: 0;
        font-family: Arial;
        background: #0f172a;
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .box {
        width: 90%;
        max-width: 420px;
        background: #1e293b;
        padding: 20px;
        border-radius: 20px;
        text-align: center;
        margin-top: 20px;
      }

      input[type="file"] { display: none; }

      .custom-file {
        display: block;
        padding: 12px;
        background: #334155;
        border-radius: 10px;
        cursor: pointer;
      }

      button {
        width: 100%;
        padding: 12px;
        margin-top: 10px;
        border-radius: 10px;
        border: none;
        background: #22c55e;
        color: white;
        cursor: pointer;
      }

      .progress {
        width: 100%;
        background: #333;
        height: 10px;
        margin-top: 10px;
        display: none;
      }

      .bar {
        height: 10px;
        width: 0%;
        background: lime;
      }

      .grid {
        width: 95%;
        max-width: 900px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        margin-top: 20px;
      }

      .card {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        cursor: pointer;
      }

      .card img, .card video {
        width: 100%;
        height: 140px;
        object-fit: contain;
        background: black;
      }

      .delete-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: red;
        border: none;
        color: white;
        border-radius: 50%;
        width: 25px;
        height: 25px;
        cursor: pointer;
      }

      .viewer {
        position: fixed;
        top:0;
        left:0;
        width:100%;
        height:100%;
        background: rgba(0,0,0,0.9);

         display: none;

         justify-content: center;
         align-items: center;
        }

      .viewer img, .viewer video {
        width: auto;
        height: auto;
        max-width: 90vw;
        max-height: 85vh;
        object-fit: contain;
      }
    </style>
  </head>

  <body>

    <div class="box">
      <h2>📁 Dosya Gönder</h2>

      <label class="custom-file">
        Dosya Seç
        <input type="file" id="file" multiple onchange="updateLabel()">
      </label>

      <div id="fileCount">Dosya seçilmedi</div>

      <button onclick="upload()">Gönder</button>

      <div class="progress" id="p">
        <div class="bar" id="b"></div>
      </div>

      <img src="/qr" width="120" style="margin-top:20px;">
      <p style="font-size:12px;">${url}</p>
    </div>

    <div id="fileList" class="grid"></div>

    <div id="viewer" class="viewer" onclick="closeViewer()">
      <div id="viewerContent"></div>
    </div>

    <script>
      function updateLabel() {
        const files = document.getElementById("file").files;
        const text = document.getElementById("fileCount");

        if (files.length === 0) {
          text.innerText = "Dosya seçilmedi";
        } else {
          text.innerText = files.length + " dosya seçildi";
        }
      }

      function upload() {
        const files = document.getElementById("file").files;
        if (!files.length) return alert("Dosya seç");

        const fd = new FormData();
        for (let f of files) fd.append("file", f);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/upload");

        const p = document.getElementById("p");
        const b = document.getElementById("b");

        p.style.display = "block";

        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            b.style.width = (e.loaded / e.total) * 100 + "%";
          }
        };

        xhr.onload = () => {
          p.style.display = "none";
          loadFiles();
        };

        xhr.send(fd);
      }

      async function loadFiles() {
        const res = await fetch("/files");
        const files = await res.json();

        const list = document.getElementById("fileList");
        list.innerHTML = "";

        files.forEach(file => {
          const div = document.createElement("div");
          div.className = "card";

          let media = "";

          if (file.type === "image") {
            media = '<img src="/uploads/' + file.name + '">';
          } else if (file.type === "video") {
            media = '<video src="/uploads/' + file.name + '"></video>';
          }

          div.innerHTML = \`
            \${media}
            <button class="delete-btn" onclick="event.stopPropagation(); deleteFile('\${file.name}')">×</button>
          \`;

          div.onclick = () => openViewer(file);

          list.appendChild(div);
        });
      }

      function openViewer(file) {
        const viewer = document.getElementById("viewer");
        const content = document.getElementById("viewerContent");

        if (file.type === "image") {
          content.innerHTML = '<img src="/uploads/' + file.name + '">';
        } else {
          content.innerHTML = '<video controls autoplay src="/uploads/' + file.name + '"></video>';
        }

        viewer.style.display = "flex";
      }

      function closeViewer() {
        document.getElementById("viewer").style.display = "none";
      }

      async function deleteFile(name) {
        await fetch("/delete/" + name, { method: "DELETE" });
        loadFiles();
      }

      loadFiles();
    </script>

  </body>
  </html>
  `);
});

app.use("/uploads", express.static("uploads"));

app.get("/qr", async (req, res) => {
  const qr = await QRCode.toBuffer(url);
  res.setHeader("Content-Type", "image/png");
  res.send(qr);
});

app.post("/upload", (req, res) => {
  if (!req.files) return res.send("Dosya yok");

  if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

  let files = req.files.file;
  if (!Array.isArray(files)) files = [files];

  files.forEach(file => file.mv("./uploads/" + file.name));

  res.send("ok");
});

app.get("/files", (req, res) => {
  if (!fs.existsSync("./uploads")) return res.json([]);

  const files = fs.readdirSync("./uploads").map(name => ({
    name,
    type: name.match(/(jpg|jpeg|png|gif)$/i) ? "image" :
          name.match(/(mp4|mov)$/i) ? "video" : "other"
  }));

  res.json(files);
});

app.delete("/delete/:name", (req, res) => {
  const filePath = "./uploads/" + req.params.name;
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.send("silindi");
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Aç: " + url);
});