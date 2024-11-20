import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import archiver from "archiver";

// Configuración de Multer para recibir archivos
const upload = multer({ dest: path.join(__dirname, "../public", "uploads/") });

const app = express();
const port = 3000;

// Servir archivos estáticos (WebP y otros archivos)
app.use(express.static(path.join(__dirname, "../public")));
app.use("/webp", express.static(path.join(__dirname, "../public", "webp")));

// Ruta para subir imágenes y convertirlas a WebP
app.post(
  "/upload",
  upload.array("images", 10), // Procesar hasta 10 imágenes
  async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = req.files as Express.Multer.File[];

    // Verificar que los archivos fueron recibidos correctamente
    if (!uploadedFiles || uploadedFiles.length === 0) {
      res.status(400).send("No se subieron archivos.");
      return;
    }

    const outputDir = path.join(__dirname, "../public", "webp");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      const convertedFiles: string[] = [];

      for (const file of uploadedFiles) {
        const outputFileName = `${path.parse(file.originalname).name}.webp`;
        const outputPath = path.join(outputDir, outputFileName);

        // Convertir la imagen a WebP
        await sharp(file.path).webp({ quality: 80 }).toFile(outputPath);

        // Eliminar el archivo original
        fs.unlinkSync(file.path);

        // Agregar la URL del archivo convertido
        convertedFiles.push(`/webp/${outputFileName}`);
      }

      res.status(200).json({ urls: convertedFiles });
      return;
    } catch (error) {
      console.error("Error al procesar las imágenes:", error);
      res.status(500).send("Ocurrió un error al procesar las imágenes.");
      return;
    }
  }
);

// Ruta para descargar el ZIP con las imágenes convertidas
app.get("/download-zip", async (req: Request, res: Response) => {
  const outputDir = path.join(__dirname, "../public", "webp");
  const zipFileName = "images-convertidas.zip";
  const zipFilePath = path.join(__dirname, zipFileName);

  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    res.download(zipFilePath, zipFileName, (err) => {
      if (err) {
        console.error("Error al descargar el archivo ZIP:", err);
      }
      fs.unlinkSync(zipFilePath); // Eliminar el archivo ZIP después de la descarga
    });
  });

  archive.on("error", (err) => {
    res.status(500).send("Ocurrió un error al generar el archivo ZIP.");
  });

  archive.pipe(output);

  // Agregar archivos WebP al archivo ZIP
  const webpFiles = fs
    .readdirSync(outputDir)
    .filter((file) => file.endsWith(".webp"));
  webpFiles.forEach((file) => {
    archive.file(path.join(outputDir, file), { name: file });
  });

  archive.finalize();
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});
