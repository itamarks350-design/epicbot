const { Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const http = require('http');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const WEBSITE_URL = 'https://epicgames-pi.vercel.app';

const client = new Client({
    intents: []
});

// שרת HTTP קטן שמטפל גם בשמירה על השרת מחובר וגם בקבלת פניות מהאתר ב-Vercel
const server = http.createServer((req, res) => {
    // הגדרת CORS כדי שהאתר ב-Vercel יוכל לפנות לשרת ב-Render
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // נתיב שהאתר פונה אליו ברגע שהמשתמש מסיים למלא את הפרטים
    if (req.method === 'POST' && req.url === '/api/start-auth') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { discordUserId } = data; // אם שלחתם ID דיסקורד מהאתר

                if (discordUserId) {
                    await initiateEpicAuth(discordUserId);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));
            } catch (err) {
                console.error('שגיאה בטיפול בפנייה מהאתר:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process request' }));
            }
        });
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP server is listening on port ${PORT}`);
});

// פונקציה שמייצרת את קישור ההתחברות המאובטח של Epic Games ושולחת בדיסקורד
async function initiateEpicAuth(userId) {
    try {
        const user = await client.users.fetch(userId);

        // 1. קבלת Access Token כללי מ-Epic Games
        const epicAuthResponse = await axios.post(
            'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic M2Y2OWUyNjg4OThlNGNmOWJhOWE2N2I2MzA2MjM2MzE6ZWExYjM1OThlYDRmNGI3OWE3NDM3NDM3NDM3NDM3NDM='
                }
            }
        );

        // 2. יצירת Device Code וקישור התחברות
        const deviceCodeResponse = await axios.post(
            'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/deviceAuthorization',
            'prompt=login',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Bearer ${epicAuthResponse.data.access_token}`
                }
            }
        );

        const loginUrl = deviceCodeResponse.data.verification_uri_complete;
        const deviceCode = deviceCodeResponse.data.device_code;

        // 3. יצירת הלחצן בדיסקורד
        const authButton = new ButtonBuilder()
            .setLabel('התחבר לחשבון Epic Games')
            .setStyle(ButtonStyle.Link)
            .setURL(loginUrl);

        const row = new ActionRowBuilder().addComponents(authButton);

        // 4. שליחת ההודעה הפרטית לדיסקורד של המשתמש (כאן תזין את הניסוח שתבחר!)
        await user.send({
            content: `אהלן! 🎮 לחץ על הלחצן למטה להתחברות מאובטחת דרך Epic Games. ברגע שתסיים להתחבר, תמונת הלוקר שלך תישלח לכאן אוטומטית!`,
            components: [row]
        });

        // 5. המתנה ברקע להתחברות המשתמש בדפדפן
        pollForEpicLogin(user, deviceCode);

    } catch (error) {
        console.error('שגיאה בתהליך התחברות Epic:', error);
    }
}

// בדיקה מחזורית ברקע עד שהמשתמש מסיים להתחבר ב-Epic
async function pollForEpicLogin(user, deviceCode) {
    const interval = setInterval(async () => {
        try {
            const tokenResponse = await axios.post(
                'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token',
                `grant_type=device_code&device_code=${deviceCode}`,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic M2Y2OWUyNjg4OThlNGNmOWJhOWE2N2I2MzA2MjM2MzE6ZWExYjM1OThlYDRmNGI3OWE3NDM3NDM3NDM3NDM3NDM='
                    }
                }
            );

            if (tokenResponse.data.access_token) {
                clearInterval(interval); // המשתמש התחבר בהצלחה!

                await user.send("✅ ההתחברות הצליחה! מכין את תמונת הלוקר שלך...");

                // שליפת הלוקר ושליחת התמונה
                const accessToken = tokenResponse.data.access_token;
                const accountId = tokenResponse.data.account_id;
                await fetchAndSendLockerImage(user, accessToken, accountId);
            }
        } catch (error) {
            // אם המשתמש עדיין לא התחבר, השרת מחזיר שגיאה צפויה של authorization_pending
            if (error.response && error.response.data.errorCode !== 'errors.com.epicgames.account.oauth.authorization_pending') {
                clearInterval(interval);
            }
        }
    }, 3000); // בדיקה כל 3 שניות
}

async function fetchAndSendLockerImage(user, accessToken, accountId) {
    // כאן הבוט מושך את הנתונים ושולח את התמונה למשתמש בדיסקורד
    await user.send({
        content: `📸 **הנה הלוקר המעודכן שלך!**`,
        files: ['https://link-to-your-generated-locker-image.png'] 
    });
}

client.once('ready', async () => {
    console.log(`הבוט התחבר בהצלחה בתור: ${client.user.tag}!`);

    const command = new SlashCommandBuilder()
        .setName('login')
        .setDescription('התחברות לחשבון')
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('מעדכן פקודות Slash (/) לאפליקציה...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: [command.toJSON()] },
        );
        console.log('הפקודות עודכנו בהצלחה!');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'login') {
        const loginButton = new ButtonBuilder()
            .setLabel('Log in')
            .setURL(WEBSITE_URL)
            .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder()
            .addComponents(loginButton);

        await interaction.reply({
            content: `Open [this link](${WEBSITE_URL}) to log in to your account.`,
            components: [row],
            flags: 6
        });
    }
});

client.login(TOKEN);
