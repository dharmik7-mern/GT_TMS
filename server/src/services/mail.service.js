import {transporter} from '../config/mail.js';

export const sendMail = async ({to, subject, html}) => {
    try{
        const info = transporter.sendMail({
            from: process.env.SMTP_USER, 
            to,
            subject,
            html
        });

        console.log("Email Sent :- ", info.messageId);
        return info;

    }
    catch(error){
        console.error("EMAIL Error ", error);
        throw new error('Email Sending Error!!!');
    }
};
