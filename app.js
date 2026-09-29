const SUPABASE_URL = "https://zbadfkbthhmxyheqokqs.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_WN1Sd-gEqAxAUX8GbsUTQQ__xvDjILL";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

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

let currentUser = null;
let realtimeChannel = null;


/* -----------------------------
   Screen handling
----------------------------- */

function showScreen(screen) {
  loginScreen.classList.add("hidden");
  setupScreen.classList.add("hidden");
  chatScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}


/* -----------------------------
   Login
----------------------------- */

loginButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMessage.textContent = "Please enter your email and password.";
    return;
  }

  authMessage.textContent = "Logging in...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMessage.textContent = error.message;
  }
});


/* -----------------------------
   Create account
----------------------------- */

signupButton.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMessage.textContent = "Enter an email and password first.";
    return;
  }

  if (password.length < 6) {
    authMessage.textContent =
      "Your password must be at least 6 characters.";
    return;
  }

  authMessage.textContent = "Creating account...";

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  if (data.session) {
    currentUser = data.user;
    await checkFamilyMembership();
  } else {
    authMessage.textContent =
      "Account created! Check your email to confirm your account.";
  }
});


/* -----------------------------
   Check family membership
----------------------------- */

async function checkFamilyMembership() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("family_members")
    .select("display_name")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) {
    showScreen(setupScreen);
    return;
  }

  currentUserElement.textContent = data.display_name;

  showScreen(chatScreen);

  await loadMessages();
  subscribeToMessages();
}


/* -----------------------------
   Join family
----------------------------- */

joinButton.addEventListener("click", async () => {
  const name = displayNameInput.value.trim();
  const code = inviteCodeInput.value.trim();

  if (!name || !code) {
    setupMessage.textContent =
      "Please enter your name and the family code.";
    return;
  }

  setupMessage.textContent = "Joining family...";

  const { data, error } = await supabaseClient.rpc(
    "join_family",
    {
      invite_code: code,
      member_name: name
    }
  );

  if (error) {
    console.error(error);
    setupMessage.textContent =
      "Something went wrong. Please try again.";
    return;
  }

  if (!data) {
    setupMessage.textContent =
      "That family invitation code is not correct.";
    return;
  }

  currentUserElement.textContent = name;

  showScreen(chatScreen);

  await loadMessages();
  subscribeToMessages();
});


/* -----------------------------
   Load messages
----------------------------- */

async function loadMessages() {
  messagesContainer.innerHTML = "";

  const { data, error } = await supabaseClient
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
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(addMessageToScreen);

  scrollToBottom();
}


/* -----------------------------
   Display message
----------------------------- */

function addMessageToScreen(message) {
  const bubble = document.createElement("div");

  bubble.className = "message-bubble";

  if (message.user_id === currentUser.id) {
    bubble.classList.add("mine");
  }

  const name = document.createElement("div");
  name.className = "message-name";

  name.textContent =
    message.family_members?.display_name || "Family member";

  const text = document.createElement("div");

  text.textContent = message.message;

  const time = document.createElement("div");
  time.className = "message-time";

  time.textContent =
    new Date(message.created_at).toLocaleString();

  bubble.appendChild(name);
  bubble.appendChild(text);
  bubble.appendChild(time);

  messagesContainer.appendChild(bubble);
}


/* -----------------------------
   Send message
----------------------------- */

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();

  if (!text || !currentUser) {
    return;
  }

  messageInput.value = "";

  const { error } = await supabaseClient
    .from("messages")
    .insert({
      user_id: currentUser.id,
      message: text
    });

  if (error) {
    console.error(error);

    alert("Message could not be sent.");

    messageInput.value = text;
  }
});


/* -----------------------------
   Realtime messages
----------------------------- */

function subscribeToMessages() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
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
      async (payload) => {

        const { data, error } =
          await supabaseClient
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

        if (!error && data) {
          addMessageToScreen(data);
          scrollToBottom();
        }
      }
    )
    .subscribe();
}


/* -----------------------------
   Scroll
----------------------------- */

function scrollToBottom() {
  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
}


/* -----------------------------
   Logout
----------------------------- */

logoutButton.addEventListener("click", async () => {
  if (realtimeChannel) {
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  await supabaseClient.auth.signOut();

  currentUser = null;

  showScreen(loginScreen);

  emailInput.value = "";
  passwordInput.value = "";
});


/* -----------------------------
   Start application
----------------------------- */

async function startApp() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    showScreen(loginScreen);
    return;
  }

  currentUser = session.user;

  await checkFamilyMembership();
}


supabaseClient.auth.onAuthStateChange(
  async (_event, session) => {

    if (!session) {
      currentUser = null;
      showScreen(loginScreen);
      return;
    }

    currentUser = session.user;

    await checkFamilyMembership();
  }
);


startApp();
