import axios from "axios";
import { createWriteStream, createReadStream } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

const url =
  "https://vip.lz-cdn9.com/20230807/17823_38357a5c/2000k/hls/mixed.m3u8";
const outputFilePath = "output.ts";

const headers = {
  authority: "vip.lz-cdn9.com",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  origin: "https://91mjw.vip",
  pragma: "no-cache",
  "sec-ch-ua":
    '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
};

export const m3u8FileDownloader = async () => {
  axios
    .get(url, { headers })
    .then(async (response) => {
      const m3u8Content = response.data;
      const lines = m3u8Content.split('\n');
      const segmentUrls = lines.filter((line: string) => line.endsWith('.ts'));


      if (segmentUrls.length > 0) {
        console.log("Video download started...");
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
        const file = createWriteStream(outputFilePath);

        for (const [index, segmentUrl] of segmentUrls.entries()) {
          const fullSegmentUrl = baseUrl + segmentUrl;
          const segmentResponse = await axios.get(fullSegmentUrl, {
            responseType: "arraybuffer",
            headers,
          });
          const buffer = Buffer.from(segmentResponse.data, "binary");
          file.write(buffer);
          console.log(`Downloaded segment ${index + 1} of ${segmentUrls.length}`);
        }
        file.end();

        file.on("finish", async () => {
          console.log("Download success", outputFilePath);

          const fileStream = createReadStream(outputFilePath);
          const uploadParams = {
            Bucket: "ryan-media-downloader-bucket",
            Key: "m3u8/video.ts",
            Body: fileStream,
          };

          try {
            const data = await s3.send(new PutObjectCommand(uploadParams));
            console.log("Upload success", data);
          } catch (err) {
            console.error("Upload error", err);
          }
        });

        file.on("error", (err) => {
          console.error("File error", err);
        });
      } else {
        console.error("Segment URLs not found");
      }
    })
    .catch((err) => {
      console.error("Download error", err);
    });
};