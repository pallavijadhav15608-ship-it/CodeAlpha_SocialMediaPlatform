
const express = require("express");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// REGISTER
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 8) {
        return res.status(400).json({
            message: "Enter your name, email, and a password of at least 8 characters."
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
        ).run(name.trim(), email.trim().toLowerCase(), hashedPassword);

        res.status(201).json({
            message: "Registration successful!",
            userId: result.lastInsertRowid
        });
    } catch (error) {
        res.status(400).json({
            message: "This email may already be registered."
        });
    }
});

// LOGIN
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    try {
        const user = db.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).get(email.trim().toLowerCase());

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        res.json({
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                bio: user.bio
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed." });
    }
});

// GET FEED
app.get("/api/posts", (req, res) => {
    const userId = Number(req.query.userId) || 0;

    try {
        const posts = db.prepare(`
            SELECT posts.id, posts.user_id, posts.content, posts.created_at,
                   users.name,
                   (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS like_count,
                   (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comment_count,
                   EXISTS(
                       SELECT 1 FROM likes
                       WHERE likes.post_id = posts.id AND likes.user_id = ?
                   ) AS liked
            FROM posts
            JOIN users ON users.id = posts.user_id
            ORDER BY posts.id DESC
        `).all(userId);

        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: "Could not load posts." });
    }
});

// CREATE POST
app.post("/api/posts", (req, res) => {
    const { userId, content } = req.body;

    if (!userId || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({
            message: "A user and post content are required."
        });
    }

    try {
        const result = db.prepare(
            "INSERT INTO posts (user_id, content) VALUES (?, ?)"
        ).run(userId, content.trim());

        res.status(201).json({
            message: "Post published!",
            postId: result.lastInsertRowid
        });
    } catch (error) {
        res.status(400).json({ message: "Could not create post." });
    }
});

// LIKE / UNLIKE
app.post("/api/posts/:id/like", (req, res) => {
    const postId = Number(req.params.id);
    const userId = Number(req.body.userId);

    if (!postId || !userId) {
        return res.status(400).json({
            message: "A user and post are required."
        });
    }

    try {
        const existing = db.prepare(
            "SELECT id FROM likes WHERE user_id = ? AND post_id = ?"
        ).get(userId, postId);

        if (existing) {
            db.prepare("DELETE FROM likes WHERE id = ?").run(existing.id);
            return res.json({ message: "Post unliked." });
        }

        db.prepare(
            "INSERT INTO likes (user_id, post_id) VALUES (?, ?)"
        ).run(userId, postId);

        res.json({ message: "Post liked!" });
    } catch (error) {
        res.status(400).json({ message: "Could not update like." });
    }
});

// GET COMMENTS
app.get("/api/posts/:id/comments", (req, res) => {
    try {
        const comments = db.prepare(`
            SELECT comments.id, comments.content, comments.created_at, users.name
            FROM comments
            JOIN users ON users.id = comments.user_id
            WHERE comments.post_id = ?
            ORDER BY comments.id ASC
        `).all(Number(req.params.id));

        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: "Could not load comments." });
    }
});

// ADD COMMENT
app.post("/api/posts/:id/comments", (req, res) => {
    const postId = Number(req.params.id);
    const { userId, content } = req.body;

    if (!userId || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({
            message: "A user and comment are required."
        });
    }

    try {
        db.prepare(
            "INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)"
        ).run(userId, postId, content.trim());

        res.status(201).json({ message: "Comment added!" });
    } catch (error) {
        res.status(400).json({ message: "Could not add comment." });
    }
});

// UPDATE PROFILE BIO
app.put("/api/profile", (req, res) => {
    const { userId, bio } = req.body;

    if (!userId || typeof bio !== "string" || bio.length > 250) {
        return res.status(400).json({
            message: "Enter a valid bio of up to 250 characters."
        });
    }

    try {
        db.prepare("UPDATE users SET bio = ? WHERE id = ?")
            .run(bio.trim(), userId);

        const user = db.prepare(
            "SELECT id, name, email, bio FROM users WHERE id = ?"
        ).get(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ message: "Profile updated!", user });
    } catch (error) {
        res.status(500).json({ message: "Could not update profile." });
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
