const SUPABASE_URL = "https://zbadfkbthhmxyheqokqs.supabase.co";
const SUPABASE_KEY = "sb_publishable_WN1Sd-gEqAxAUX8GbsUTQQ__xvDjILL";

let supabaseClient = null;
let currentUser = null;
let realtimeChannel = null;

// Page elements
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

function showScreen(screen) {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (setupScreen) setupScreen.classList.add("hidden");
  if (chatScreen) chatScreen.classList.add("hidden");

  if (screen) screen.classList.remove("hidden");
}

async function startApp() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      if (authMessage) authMessage.textContent = "The chat system library failed to load. Please refresh the page.";
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const result = await supabaseClient.auth.getSession();

    if (result.error || !result.data.session) {
      showScreen(loginScreen);
      return;
    }

    currentUser = result.data.session.user;
    await checkFamilyMembership();

  } catch (error) {
    console.error("Startup exception:", error);
    showScreen(loginScreen);
  }
}

if (loginButton) {
  loginButton.addEventListener("click", async function () {
    if (!supabaseClient) return;

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password) {
      if (authMessage) authMessage.textContent = "Please enter email and password.";
      return;
    }

    if (authMessage) authMessage.textContent = "Logging in...";
    loginButton.disabled = true;

    try {
      const result = await supabaseClient.auth.signInWithPassword({ email, password });

      if (result.error) {
        if (authMessage) authMessage.textContent = result.error.message;
        loginButton.disabled = false;
        return;
      }

      currentUser = result.data.user;
      if (authMessage) authMessage.textContent = "";
      await checkFamilyMembership();

    } catch (error) {
      if (authMessage) authMessage.textContent = "Login failed.";
    }

    loginButton.disabled = false;
  });
}

if (signupButton) {
  signupButton.addEventListener("click", async function () {
    if (!supabaseClient) return;

    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!email || !password || password.length < 6) {
      if (authMessage) authMessage.textContent = "Provide a valid email and 6+ char password.";
      return;
    }

    if (authMessage) authMessage.textContent = "Creating account...";
    signupButton.disabled = true;

    try {
      const result = await supabaseClient.auth.signUp({ email, password });

      if (result.error) {
        if (authMessage) authMessage.textContent = result.error.message;
        signupButton.disabled = false;
        return;
      }

      if (!result.data.session) {
        if (authMessage) authMessage.textContent = "Account created! Check email confirmation.";
        signupButton.disabled = false;
        return;
      }

      currentUser = result.data.user;
      if (authMessage) authMessage.textContent = "";
      await checkFamilyMembership();

    } catch (error) {
      if (authMessage) authMessage.textContent = "Signup failed.";
    }

    signupButton.disabled = false;
  });
}

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

    if (result.error || !result.data) {
      showScreen(setupScreen);
      return;
    }

    if (currentUserElement) currentUserElement.textContent = result.data.display_name;
    showScreen(chatScreen);
    await loadMessages();
    subscribeToMessages();

  } catch (error) {
    showScreen(loginScreen);
  }
}

if (joinButton) {
  joinButton.addEventListener("click", async function () {
    if (!supabaseClient || !currentUser) return;

    const name = displayNameInput ? displayNameInput.value.trim() : "";
    const code = inviteCodeInput ? inviteCodeInput.value.trim() : "";

    if (!name || !code) return;

    joinButton.disabled = true;

    try {
      const result = await supabaseClient.rpc("join_family", {
        invite_code: code,
        member_name: name
      });

      if (result.error || !result.data) {
        if (setupMessage) setupMessage.textContent = result.error?.message || "Invalid invite code.";
        joinButton.disabled = false;
        return;
      }

      if (currentUserElement) currentUserElement.textContent = name;
      showScreen(chatScreen);
      await loadMessages();
      subscribeToMessages();

    } catch (error) {
      if (setupMessage) setupMessage.textContent = "Join failed.";
    }

    joinButton.disabled = false;
  });
}

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
        family_members ( display_name )
      `)
      .order("created_at", { ascending: true });

    if (result.data) {
      result.data.forEach(addMessageToScreen);
    }

    scrollToBottom();
  } catch (error) {
    console.error("Load error:", error);
  }
}

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
  time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.appendChild(name);
  bubble.appendChild(text);
  bubble.appendChild(time);

  messagesContainer.appendChild(bubble);
}

async function sendMessageNow(e) {
  if (e) e.preventDefault();
  if (!messageInput) return;

  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  messageInput.value = "";

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([{ user_id: currentUser.id, message: text }])
      .select(`
        id,
        message,
        created_at,
        user_id,
        family_members ( display_name )
      `)
      .single();

    if (error) {
      alert("Error sending message: " + error.message);
      messageInput.value = text;
      return;
    }

    if (data) {
      addMessageToScreen(data);
      scrollToBottom();
    }
  } catch (err) {
    alert("Could not send message.");
    messageInput.value = text;
  }
}

if (messageForm) {
  messageForm.onsubmit = sendMessageNow;
}

function subscribeToMessages() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabaseClient
    .channel("family-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async function (payload) {
        const result = await supabaseClient
          .from("messages")
          .select(`
            id,
            message,
            created_at,
            user_id,
            family_members ( display_name )
          `)
          .eq("id", payload.new.id)
          .maybeSingle();

        if (result.data) {
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

if (logoutButton) {
  logoutButton.addEventListener("click", async function () {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    await supabaseClient.auth.signOut();
    currentUser = null;
    showScreen(loginScreen);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
