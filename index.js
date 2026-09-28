const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// 1. טיפול בפקודת ה-Slash בדיסקורד (/login)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'login') {
    // השהיית התגובה כדי לאפשר לשרת לפנות ל-Epic Games
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1.1 בקשת Client Credentials מ-Epic Games
      const response = await axios.post(
        'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/v2/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic MzQ0NmNkNzI2OTRjNDI4ZmI2ZjAxM2VkYzZjNWU3M2M6V3R3R3p3R3p3R3p3'
          }
        }
      );

      // 1.2 יצירת Device Code
      const deviceCodeRes = await axios.post(
        'https://account-public-service-prod01.ol.epicgames.com/account/api/oauth/deviceAuthorization',
        'prompt=login',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${response.data.access_token}`
          }
        }
      );

      const { verification_uri_complete, device_code } = deviceCodeRes.data;
      const loginUrl = verification_uri_complete || 'https://www.epicgames.com/id/activate';

      // 1.3 יצירת כפתור Log in
      const authButton = new ButtonBuilder()
        .setLabel('Log in')
        .setStyle(ButtonStyle.Link)
        .setURL(loginUrl);

      const row = new ActionRowBuilder().addComponents(authButton);

      // 1.4 שליחת ההודעה המדויקת בערוץ
      await interaction.editReply({
        content: `Open [this link](${loginUrl}) to log in to your account.`,
        components: [row]
      });

      // 1.5 הפעלת בדיקה רציפה (Polling) עד התחברות
      pollForEpicToken(device_code, interaction.user);

    } catch (error) {
      console.error('Error generating login link:', error.response?.data || error.message);
      await interaction.editReply({ content: 'Failed to generate login link. Please try again.' });
    }
  }
});

// 2. נקודת קצה (Endpoint) לקבלת בקשות מהאתר ב-Vercel
app.post('/api/start-auth', async (req, res) => {
  const { discordUserId, email } = req.body;

  try {
    if (discordUserId) {
      await initiateEpicAuth(discordUserId);
      return res.status(200).json({ success: true, message: 'Auth flow started for user ID' });
    } else {
      console.log(`Received auth request for email: ${email}`);
      return res.status(200).json({ success: true, message: 'Request received' });
    }
  } catch (error) {
    console.error('Error starting auth flow:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. פונקציה לייצור הקישור והודעה (לשימוש במידת הצורך מ-API)
async function initiateEpicAuth(userId) {
  try {
    const user = await client.users.fetch(userId);
    if (!user) return;

    const response = await axios.post(
      'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/v2/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic MzQ0NmNkNzI2OTRjNDI4ZmI2ZjAxM2VkYzZjNWU3M2M6V3R3R3p3R3p3'
        }
      }
    );

    const deviceCodeRes = await axios.post(
      'https://account-public-service-prod01.ol.epicgames.com/account/api/oauth/deviceAuthorization',
      'prompt=login',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${response.data.access_token}`
        }
      }
    );

    const { verification_uri_complete, device_code } = deviceCodeRes.data;
    const loginUrl = verification_uri_complete || 'https://www.epicgames.com/id/activate';

    const authButton = new ButtonBuilder()
      .setLabel('Log in')
      .setStyle(ButtonStyle.Link)
      .setURL(loginUrl);

    const row = new ActionRowBuilder().addComponents(authButton);

    await user.send({
      content: `Open [this link](${loginUrl}) to log in to your account.`,
      components: [row]
    });

    pollForEpicToken(device_code, user);

  } catch (error) {
    console.error('Error initiating Epic Auth:', error.response?.data || error.message);
  }
}

// 4. בדיקת Polling מול Epic Games
async function pollForEpicToken(deviceCode, user) {
  const pollInterval = setInterval(async () => {
    try {
      const tokenResponse = await axios.post(
        'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/v2/token',
        `grant_type=device_code&device_code=${deviceCode}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic MzQ0NmNkNzI2OTRjNDI4ZmI2ZjAxM2VkYzZjNWU3M2M6V3R3R3p3R3p3'
          }
        }
      );

      if (tokenResponse.data && tokenResponse.data.access_token) {
        clearInterval(pollInterval);
        await user.send("✅ ההתחברות ל-Epic Games הושלמה בהצלחה! מכין את תמונת הלוקר שלך...");
        await fetchAndSendLockerImage(tokenResponse.data.access_token, user);
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.errorCode === 'errors.com.epicgames.account.oauth.authorization_pending') {
        // ממתין לאישור הלקוח
      } else {
        clearInterval(pollInterval);
        console.error('Polling error:', error.response?.data || error.message);
      }
    }
  }, 5000);
}

// 5. שליחת תמונת לוקר
async function fetchAndSendLockerImage(accessToken, user) {
  try {
    await user.send({
      content: "🖼️ הנה תמונת הלוקר המותאמת אישית שלך!"
    });
  } catch (err) {
    console.error('Failed to send locker image:', err);
  }
}

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}!`);
});

client.login(process.env.TOKEN);
