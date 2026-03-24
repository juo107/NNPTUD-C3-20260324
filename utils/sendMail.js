const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: "f52d396b7c4943",
        pass: "dc39e3b6ae8599"
    }
});

module.exports = {
    sendMail: async function (to, subject, text, html) {
        try {
            await transporter.sendMail({
                from: '"Admin" <admin@haha.com>',
                to: to,
                subject: subject,
                text: text,
                html: html
            });
            console.log(`Email sent to: ${to}`);
        } catch (error) {
            console.error(`Failed to send email to ${to}:`, error);
            throw error;
        }
    }
}
