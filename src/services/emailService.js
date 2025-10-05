const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function enviarEmail(to, subject, html) {
  const msg = {
    to,
    from: process.env.EMAIL_FROM, // seu e-mail
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log("E-mail enviado com sucesso para:", to);
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    if (error.response) console.error(error.response.body);
  }
}

module.exports = { enviarEmail };
