const SUPABASE_URL = "https://zbadfkbthhmxyheqokqs.supabase.co";
const SUPABASE_KEY = "sb_publishable_WN1Sd-gEqAxAUX8GbsUTQQ__xvDjILL";

let supabaseClient = null;
let currentUser = null;
let realtimeChannel = null;

// Get page elements
const loginScreen = document.getElementById("login-screen");
const setupScreen = document.getElementById("setup-screen");
const chatScreen = document.getElementById("chat-screen");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginButton = document.getElementById("login-button");
const signupButton = document.getElementById("signup-button");

const authMessage = document.getElementById("auth-message");

const displayNameInput = document.getElementById("display-name");
const inviteCodeInput = document.getElementById("invite-code");
const joinButton = document.getElementById("join-button");
const setupMessage = document.getElementById("setup-message");

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");

const logoutButton = document.getElementById("logout-button");
const currentUserElement = document.getElementById("current-user");

// Show screen helper
function showScreen(screen) {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.add("hidden");
  if (chatScreen) chatScreen.classList.add("hidden");

  if (screen) screen.classList.remove("hidden");
}

// Startup initialization
async function startApp() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      if (authMessage) authMessage.textContent = "The chat system library failed to load. Please refresh the page.";
      console.error("Supabase SDK not loaded on window.");
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const result = await supabaseClient.auth.getSession();

    if (result.error) {
      console.error("Session error:", result.error);
      if (authMessage) authMessage.textContent = "Could not connect to the login system.";
      return;
    }

    if (!result.data.session) {
      showScreen(loginScreen);
      return;
    }

    currentUser = result.data.session.user;
    await checkFamilyMembership();

  } catch (error) {
    console.error("Startup exception:", error);
    if (authMessage) authMessage.textContent = "Something went wrong. Please refresh the page.";
  }
}

// Login Handler
if (loginButton) {
  loginButton.addEventListener("click", async function () {
    if (!supabaseClient) {
      if (authMessage) authMessage.textContent = "System still loading. Please wait a moment and try again.";
      return;
    }

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      if (authMessage) authMessage.textContent = "Please enter your email and password.";
      return;
    }

    if (authMessage) authMessage.textContent = "Logging in...";
    loginButton.disabled = true;

    try {
      const result = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (result.error) {
        console.error("Login error:", result.error);
        if (authMessage) authMessage.textContent = result.error.message;
        loginButton.disabled = false;
        return;
      }

      currentUser = result.data.user;
      if (authMessage) authMessage.textContent = "";
      await checkFamilyMembership();

    } catch (error) {
      console.error("Login exception:", error);
      if (authMessage) authMessage.textContent = "Login failed. Please try again.";
    }

    loginButton.disabled = false;
  });
}

// Signup Handler
if (signupButton) {
  signupButton.addEventListener("click", async function () {
    if (!supabaseClient) {
      if (authMessage) authMessage.textContent = "Please wait a moment and try again.";
      return;
    }

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      if (authMessage) authMessage.textContent = "Enter an email and password first.";
      return;
    }

    if (password.length < 6) {
      if (authMessage) authMessage.textContent = "Your password must be at least 6 characters.";
      return;
    }

    if (authMessage) authMessage.textContent = "Creating account...";
    signupButton.disabled = true;

    try {
      const result = await supabaseClient.auth.signUp({
        email: email,
        password: password
      });

      if (result.error) {
        console.error("Signup error:", result.error);
        if (authMessage) authMessage.textContent = result.error.message;
        signupButton.disabled = false;
        return;
      }

      if (!result.data.session) {
        if (authMessage) authMessage.textContent = "Account created! Check your email and click the confirmation link.";
        signupButton.disabled = false;
        return;
      }

      currentUser = result.data.user;
      if (authMessage) authMessage.textContent = "";
      await checkFamilyMembership();

    } catch (error) {
      console.error("Signup exception:", error);
      if (authMessage) authMessage.textContent = "Account creation failed. Please try again.";
    }

    signupButton.disabled = false;
  });
}

// Check family membership
async function checkFamilyMembership() {
  if (!currentUser) {
    showScreen(loginScreen);
    return;
  }

  try {
    const result = await supabaseClient
      .from("family_members")
      .select("display_name")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (result.error) {
      console.error("Membership error:", result.error);
      showScreen(loginScreen);
      if (authMessage) authMessage.textContent = "Login worked, but the family database could not be reached.";
      return;
    }

    if (!result.data) {
      if (setupMessage) setupMessage.textContent = "";
      if (displayNameInput) displayNameInput.value = "";
      if (inviteCodeInput) inviteCodeInput.value = "";
      showScreen(setupScreen);
      return;
    }

    if (currentUserElement) currentUserElement.textContent = result.data.display_name;
    showScreen(chatScreen);
    await loadMessages();
    subscribeToMessages();

  } catch (error) {
    console.error("Membership exception:", error);
    showScreen(loginScreen);
    if (authMessage) authMessage.textContent = "Something went wrong. Please try again.";
  }
}

// Join family Handler
if (joinButton) {
  joinButton.addEventListener("click", async function () {
    if (!supabaseClient || !currentUser) {
      if (setupMessage) setupMessage.textContent = "Please log in again.";
      return;
    }

    const name = displayNameInput ? displayNameInput.value.trim() : "";
    const code = inviteCodeInput ? inviteCodeInput.value.trim() : "";

    if (!name || !code) {
      if (setupMessage) setupMessage.textContent = "Please enter your name and the family code.";
      return;
    }

    if (setupMessage) setupMessage.textContent = "Joining family...";
    joinButton.disabled = true;

    try {
      const result = await supabaseClient.rpc("join_family", {
        invite_code: code,
        member_name: name
      });

      if (result.error) {
        console.error("Join error:", result.error);
        if (setupMessage) setupMessage.textContent = result.error.message;
        joinButton.disabled = false;
        return;
      }

      if (!result.data) {
        if (setupMessage) setupMessage.textContent = "That family invitation code is not correct.";
        joinButton.disabled = false;
        return;
      }

      if (currentUserElement) currentUserElement.textContent = name;
      if (setupMessage) setupMessage.textContent = "";
      showScreen(chatScreen);
      await loadMessages();
      subscribeToMessages();

    } catch (error) {
      console.error("Join exception:", error);
      if (setupMessage) setupMessage.textContent = "Something went wrong. Please try again.";
    }

    joinButton.disabled = false;
  });
}

// Load messages
async function loadMessages() {
  if (!currentUser || !messagesContainer) return;

  messagesContainer.innerHTML = "";

  try {
    const result = await supabaseClient
      .from("messages")
      .select(`
        id,
        message,
        created_at,
        user_id,
        family_members (
          display_name
        )
      `)
      .order("created_at", { ascending: true });

    if (result.error) {
      console.error("Load messages error:", result.error);
      return;
    }

    if (result.data) {
      result.data.forEach(addMessageToScreen);
    }

    scrollToBottom();

  } catch (error) {
    console.error("Load messages exception:", error);
  }
}

// Display message
function addMessageToScreen(message) {
  if (!messagesContainer) return;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (currentUser && message.user_id === currentUser.id) {
    bubble.classList.add("mine");
  }

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = message.family_members?.display_name || "Family member";

  const text = document.createElement("div");
  text.textContent = message.message;

  const time = document.createElement("div");
  time.className = "message-time";
  time.textContent = new Date(message.created_at).toLocaleString();

  bubble.appendChild(name);
  bubble.appendChild(text);
  bubble.appendChild(time);

  messagesContainer.appendChild(bubble);
}

// Direct function for sending message
async function handleSendMessage() {
  if (!messageInput) return;

  const text = messageInput.value.trim();

  if (!text || !currentUser) {
    return;
  }

  messageInput.value = "";

  try {
    const result = await supabaseClient
      .from("messages")
      .insert({
        user_id: currentUser.id,
        message: text
      });

    if (result.error) {
      console.error("Send message error:", result.error);
      alert("Message could not be sent: " + result.error.message);
      messageInput.value = text;
    }
  } catch (error) {
    console.error("Send message exception:", error);
    alert("Message could not be sent.");
    messageInput.value = text;
  }
}

// Send message via Form Submit (Pressing Enter or Submit Button)
if (messageForm) {
  messageForm.addEventListener("submit", function (event) {
    event.preventDefault();
    handleSendMessage();
  });
}

// Backup Listener: Direct Click on the Submit Button inside messageForm
const submitBtn = messageForm ? messageForm.querySelector("button[type='submit']") : null;
if (submitBtn) {
  submitBtn.addEventListener("click", function (event) {
    event.preventDefault();
    handleSendMessage();
  });
}

// Realtime
function subscribeToMessages() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabaseClient
    .channel("family-chat")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages"
      },
      async function (payload) {
        const result = await supabaseClient
          .from("messages")
          .select(`
            id,
            message,
            created_at,
            user_id,
            family_members (
              display_name
            )
          `)
          .eq("id", payload.new.id)
          .single();

        if (!result.error && result.data) {
          addMessageToScreen(result.data);
          scrollToBottom();
        }
      }
    )
    .subscribe();
}

function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Logout Handler
if (logoutButton) {
  logoutButton.addEventListener("click", async function () {
    if (realtimeChannel) {
      await supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    await supabaseClient.auth.signOut();
    currentUser = null;

    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (authMessage) authMessage.textContent = "";

    showScreen(loginScreen);
  });
}

// Start app on DOMContentLoaded

window.addEventListener("load", function () {
  console.log("FAMILY CHAT APP.JS LOADED");
  startApp();
});


