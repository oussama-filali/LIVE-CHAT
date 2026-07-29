import {z} from 'zod';
import {prisma} from '../../config/postgres.js';
import {env} from '../../config/env.js';
import {
    hashPassword,
    comparePassword,
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken

} from './auth.service.js';

//validation des entrées de l'utilisateur
const registerSchema = z.object({
    username: z.string().min(3, { message: 'Le nom d\'utilisateur doit avoir entre 3 et 32 caractères' }).max(32),
    email: z.string().email({ message: 'Email invalide' }),
    password: z.string().min(6, { message: ' hé hé il connait pas son mot de passe' }).max(100),
});

const loginSchema = z.object({
    email: z.string().email({ message: 'Email invalide' }),
    password: z.string().min(6, { message: ' hé hé il connait pas son mot de passe' }).max(100)
});

// cookie options
const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
};

// 15 minutes
const ACCESS_TOKEN_COOKIE_MAX_AGE = 15 * 60 * 1000;

// 7 days
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// fonction privée qui pose les 2 cookies d'authentification
const setAuthCookies = (res, userId) => {
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE,
    });
    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });
};
 // register
export const register = async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
    }
        const { username, email, password } = parsed.data;

        const existingUser = await prisma.user.findFirst({
         where: { OR: [{ email }, { username }] }

        });

        if (existingUser) {
            return res.status(409).json({ error: 'Cet email ou ce nom d\'utilisateur est déjà utilisé' });
        }

        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash: hashedPassword
            }
        });

        setAuthCookies(res, user.id);
        res.status(201).json({ id: user.id, username: user.username, email: user.email });

    }

// login
export const login = async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ error: 'une autre fois peut inshallah' });
    }

    const validePassword = await comparePassword(password, user.passwordHash);
    if (!validePassword) {
        return res.status(401).json({ error: 'une autre fois peut inshallah' });
    }

    setAuthCookies(res, user.id);
    res.status(200).json({ id: user.id, username: user.username, email: user.email });
};

// refresh token
export const refresh = (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'Token de rafraîchissement manquant' });
    }

    let decoded;
    try {
        decoded = verifyRefreshToken(token);
    } catch (err) {
        return res.status(401).json({ error: 'Token de rafraîchissement invalide' });
    }
    setAuthCookies(res, decoded.sub);
    res.status(200).json({ message: 'Token rafraîchi avec succès' });

};

// logout
export const logout = (req, res) => {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.status(200).json({ message: 'Déconnexion réussie' });
};
