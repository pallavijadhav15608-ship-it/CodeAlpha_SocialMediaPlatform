
let currentUser = JSON.parse(localStorage.getItem("socialUser") || "null");

function updateStatus() {
    document.getElementById("userStatus").textContent =
        currentUser ? `Welcome, ${currentUser.name}!` : "Welcome, Guest!";
}
// API helper
async function api(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

function updateStatus() {
    document.getElementById("userStatus").textContent =
        currentUser ? `Welcome, ${currentUser.name}!` : "Welcome, Guest!";
}

// REGISTER
async function registerUser() {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    if (!name || !email || password.length < 8) {
        alert("Enter your name, email, and a password of at least 8 characters.");
        return;
    }

    try {
        const data = await api("/api/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });

        alert(data.message);
        closeModals();
        showLogin();
    } catch (error) {
        alert(error.message);
    }
}

// LOGIN
async function loginUser() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        currentUser = data.user;
        localStorage.setItem("socialUser", JSON.stringify(currentUser));

        closeModals();
        updateStatus();
        loadPosts();
        alert("Login successful!");
    } catch (error) {
        alert(error.message);
    }
}

// LOGOUT
function logoutUser() {
    currentUser = null;
    localStorage.removeItem("socialUser");
    updateStatus();
    loadPosts();
    showFeed();
    alert("You have logged out.");
}

// MODALS
function showRegister() {
    closeModals();
    document.getElementById("registerBox").style.display = "flex";
}

function showLogin() {
    closeModals();
    document.getElementById("loginBox").style.display = "flex";
}

function closeModals() {
    document.getElementById("registerBox").style.display = "none";
    document.getElementById("loginBox").style.display = "none";
}

// CREATE POST
async function createPost() {
    if (!currentUser) {
        alert("Please log in before creating a post.");
        showLogin();
        return;
    }

    const content = document.getElementById("postContent").value.trim();

    if (!content) {
        alert("Please write something first.");
        return;
    }

    try {
        await api("/api/posts", {
            method: "POST",
            body: JSON.stringify({
                userId: currentUser.id,
                content
            })
        });

        document.getElementById("postContent").value = "";
        loadPosts();
    } catch (error) {
        alert(error.message);
    }
}

// LOAD FEED
async function loadPosts() {
    const container = document.getElementById("posts");

    try {
        const posts = await api("/api/posts");

        if (!posts.length) {
            container.innerHTML = "<p>No posts yet. Be the first to share!</p>";
            return;
        }

        container.innerHTML = "";

        posts.forEach(post => {
            const article = document.createElement("article");
            article.className = "post";

            const header = document.createElement("div");
            header.className = "post-header";

            const author = document.createElement("strong");
            author.textContent = post.name;

            const date = document.createElement("small");
            date.textContent = new Date(
                post.created_at.replace(" ", "T") + "Z"
            ).toLocaleString();

            header.append(author, date);

            const content = document.createElement("p");
            content.className = "post-content";
            content.textContent = post.content;

            const actions = document.createElement("div");
            actions.className = "post-actions";

            const likeButton = document.createElement("button");
            likeButton.textContent =
                `${post.liked ? "❤️ Unlike" : "🤍 Like"} (${post.like_count})`;
            likeButton.onclick = () => toggleLike(post.id);

            const commentButton = document.createElement("button");
            commentButton.textContent = `Comments (${post.comment_count})`;
            commentButton.onclick = () => loadComments(post.id, article);

            actions.append(likeButton, commentButton);
            article.append(header, content, actions);
            container.appendChild(article);
        });
    } catch (error) {
        container.textContent = "Could not load posts. Please try again.";
        console.error(error);
    }
}

// LIKE / UNLIKE
async function toggleLike(postId) {
    if (!currentUser) {
        alert("Please log in to like posts.");
        showLogin();
        return;
    }

    try {
        await api(`/api/posts/${postId}/like`, {
            method: "POST",
            body: JSON.stringify({ userId: currentUser.id })
        });

        loadPosts();
    } catch (error) {
        alert(error.message);
    }
}

// COMMENTS
async function loadComments(postId, article) {
    let panel = article.querySelector(".comments-panel");

    if (panel) {
        panel.remove();
        return;
    }

    panel = document.createElement("div");
    panel.className = "comments-panel";
    panel.textContent = "Loading comments...";
    article.appendChild(panel);

    try {
        const comments = await api(`/api/posts/${postId}/comments`);
        panel.innerHTML = "";

        comments.forEach(comment => {
            const item = document.createElement("div");
            item.className = "comment";

            const author = document.createElement("strong");
            author.textContent = comment.name + ": ";

            const text = document.createElement("span");
            text.textContent = comment.content;

            item.append(author, text);
            panel.appendChild(item);
        });

        if (!comments.length) {
            panel.textContent = "No comments yet.";
        }

        if (currentUser) {
            const input = document.createElement("input");
            input.placeholder = "Write a comment...";
            input.maxLength = 500;

            const button = document.createElement("button");
            button.textContent = "Comment";
            button.onclick = async () => {
                const content = input.value.trim();
                if (!content) return;

                try {
                    await api(`/api/posts/${postId}/comments`, {
                        method: "POST",
                        body: JSON.stringify({
                            userId: currentUser.id,
                            content
                        })
                    });
                    loadComments(postId, article);
                    loadPosts();
                } catch (error) {
                    alert(error.message);
                }
            };

            panel.append(input, button);
        }
    } catch (error) {
        panel.textContent = "Could not load comments.";
    }
}

// PROFILE
function showProfile() {
    if (!currentUser) {
        alert("Please log in first.");
        showLogin();
        return;
    }

    document.getElementById("profileSection").style.display = "block";
    document.getElementById("feedSection").style.display = "none";
    document.getElementById("createPost").style.display = "none";

    document.getElementById("profileName").textContent =
        "Name: " + currentUser.name;
    document.getElementById("profileEmail").textContent =
        "Email: " + currentUser.email;
    document.getElementById("profileBio").value = currentUser.bio || "";
}

function showFeed() {
    document.getElementById("profileSection").style.display = "none";
    document.getElementById("feedSection").style.display = "block";
    document.getElementById("createPost").style.display = "block";
    loadPosts();
}

// SAVE BIO
async function saveBio() {
    if (!currentUser) return;

    const bio = document.getElementById("profileBio").value.trim();

    try {
        const data = await api("/api/profile", {
            method: "PUT",
            body: JSON.stringify({ userId: currentUser.id, bio })
        });

        currentUser = data.user;
        localStorage.setItem("socialUser", JSON.stringify(currentUser));
        alert("Profile updated successfully!");
    } catch (error) {
        alert(error.message);
    }
}

// START
updateStatus();
loadPosts();
