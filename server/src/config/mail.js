import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const transporter = nodemailer.createTransport({

    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_USER_PASS
    }
});

transporter.verify((err,success) => {
    if(err){
        console.log("SMTP Connection Failed ...",err);
    }
    else{
        console.log("SMTP Server is ready");
    }
});
