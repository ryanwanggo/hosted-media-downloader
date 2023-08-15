import axios, { AxiosResponse } from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs, { createReadStream, createWriteStream } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const downloadUrl = 'https://www.pexels.com/download/video/17841950/';
const filePath = 'video.mp4';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

export async function mp4Filedownloader() {
  // Download the video
  axios({
    url: downloadUrl,
    method: 'GET',
    responseType: 'stream',
  }).then((response: AxiosResponse<any>) => {
    const file = createWriteStream(filePath);
    response.data.pipe(file);

    file.on('finish', async () => {
      // Upload to S3
      const fileStream = createReadStream(filePath);
      const uploadParams = {
        Bucket: 'ryan-media-downloader-bucket',
        Key: 'path/to/video.mp4',
        Body: fileStream,
      };

      try {
        const data = await s3.send(new PutObjectCommand(uploadParams));
        console.log('Upload success', data);
      } catch (err) {
        console.error('Upload error', err);
      }

      // Delete the local file if needed
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting file', err);
      });
    });

    file.on('error', (err: NodeJS.ErrnoException | null) => {
      if (err) console.error('File error', err);
      fs.unlink(filePath, (unlinkErr: NodeJS.ErrnoException | null) => {
        if (unlinkErr) console.error('File unlink error', unlinkErr);
      });
    });
  });
}