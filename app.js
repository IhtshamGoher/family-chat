```javascript
const SUPABASE_URL = "https://zbadfkbthhmxyheqokqs.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_WN1Sd-gEqAxAUX8GbsUTQQ__xvDjILL";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// -----------------------------
// Get page elements
// -----------------------------

const loginScreen = document.getElementById("login-screen");
const setupScreen = document.getElementById("setup-screen");
const chatScreen = document.getElementById("chat-screen");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const loginButton = document.getElementById("login-button");
const signupButton = document.getElementById("signup-button");

const authMessage = document.getElementById("auth-message");

const displayNameInput =
  document.getElementById("display-name");

const inviteCodeInput =
  document.getElementById("invite-code");

const joinButton =
  document.getElementById("join-button");

const setupMessage =
  document.getElementById("setup-message");

const messagesContainer =
  document.getElementById("messages");

const messageForm =
  document.getElementById("message-form");

const messageInput =
  document.getElementById("message-input");

const logoutButton =
  document.getElementById("logout-button");

const currentUserElement =
  document.getElementById("current-user");


// -----------------------------
// App variables
// -----------------------------

let currentUser = null;
let realtimeChannel = null;


// -----------------------------
// Show screen
// -----------------------------

function showScreen(screen) {
  loginScreen.classList.add("hidden");
  setupScreen.classList.add("hidden");
  chatScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}


// -----------------------------
// Show login
// -----------------------------

function showLogin(message = "") {
  showScreen(loginScreen);
  authMessage.textContent = message;
}


// -----------------------------
// Login
// -----------------------------

loginButton.addEventListener("click", async function () {

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMessage.textContent =
      "Please enter your email and password.";

    return;
  }

  authMessage.textContent = "Logging in...";
  loginButton.disabled = true;

  try {

    const result =
      await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (result.error) {

      console.error(
        "Login error:",
        result.error
      );

      authMessage.textContent =
        result.error.message;

      loginButton.disabled = false;

      return;
    }

    currentUser = result.data.user;

    authMessage.textContent = "";

    await checkFamilyMembership();

  } catch (error) {

    console.error(
      "Unexpected login error:",
      error
    );

    authMessage.textContent =
      "Login failed. Please try again.";

  }

  loginButton.disabled = false;
});


// -----------------------------
// Create account
// -----------------------------

signupButton.addEventListener(
  "click",
  async function () {

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {

      authMessage.textContent =
        "Enter an email and password first.";

      return;
    }

    if (password.length < 6) {

      authMessage.textContent =
        "Your password must be at least 6 characters.";

      return;
    }

    authMessage.textContent =
      "Creating account...";

    signupButton.disabled = true;

    try {

      const result =
        await supabaseClient.auth.signUp({
          email: email,
          password: password
        });

      if (result.error) {

        console.error(
          "Signup error:",
          result.error
        );

        authMessage.textContent =
          result.error.message;

        signupButton.disabled = false;

        return;
      }

      /*
       If email confirmation is enabled,
       Supabase normally gives us no session.
      */

      if (!result.data.session) {

        authMessage.textContent =
          "Account created! Check your email and click the confirmation link.";

        signupButton.disabled = false;

        return;
      }

      currentUser = result.data.user;

      authMessage.textContent = "";

      await checkFamilyMembership();

    } catch (error) {

      console.error(
        "Unexpected signup error:",
        error
      );

      authMessage.textContent =
        "Account creation failed. Please try again.";
    }

    signupButton.disabled = false;
  }
);


// -----------------------------
// Check family membership
// -----------------------------

async function checkFamilyMembership() {

  if (!currentUser) {
    showLogin(
      "Please log in again."
    );

    return;
  }

  try {

    const result =
      await supabaseClient
        .from("family_members")
        .select("display_name")
        .eq("user_id", currentUser.id)
        .maybeSingle();


    if (result.error) {

      console.error(
        "Membership check error:",
        result.error
      );

      showLogin(
        "Could not connect to the family database."
      );

      return;
    }


    /*
      User has an account but is not
      yet a member of the family.
    */

    if (!result.data) {

      setupMessage.textContent = "";

      displayNameInput.value = "";
      inviteCodeInput.value = "";

      showScreen(setupScreen);

      return;
    }


    /*
      User is already a family member.
    */

    currentUserElement.textContent =
      result.data.display_name;

    showScreen(chatScreen);

    await loadMessages();

    subscribeToMessages();

  } catch (error) {

    console.error(
      "Membership error:",
      error
    );

    showLogin(
      "Something went wrong. Please try again."
    );
  }
}


// -----------------------------
// Join family
// -----------------------------

joinButton.addEventListener(
  "click",
  async function () {

    const name =
      displayNameInput.value.trim();

    const code =
      inviteCodeInput.value.trim();

    if (!name || !code) {

      setupMessage.textContent =
        "Please enter your name and the family code.";

      return;
    }

    setupMessage.textContent =
      "Joining family...";

    joinButton.disabled = true;

    try {

      const result =
        await supabaseClient.rpc(
          "join_family",
          {
            invite_code: code,
            member_name: name
          }
        );


      if (result.error) {

        console.error(
          "Join family error:",
          result.error
        );

        setupMessage.textContent =
          result.error.message;

        joinButton.disabled = false;

        return;
      }


      if (!result.data) {

        setupMessage.textContent =
          "That family invitation code is not correct.";

        joinButton.disabled = false;

        return;
      }


      currentUserElement.textContent =
        name;

      setupMessage.textContent = "";

      showScreen(chatScreen);

      await loadMessages();

      subscribeToMessages();

    } catch (error) {

      console.error(
        "Unexpected join error:",
        error
      );

      setupMessage.textContent =
        "Something went wrong. Please try again.";
    }

    joinButton.disabled = false;
  }
);


// -----------------------------
// Load messages
// -----------------------------

async function loadMessages() {

  if (!currentUser) {
    return;
  }

  messagesContainer.innerHTML = "";

  try {

    const result =
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
        .order("created_at", {
          ascending: true
        });


    if (result.error) {

      console.error(
        "Load messages error:",
        result.error
      );

      return;
    }


    if (result.data) {

      result.data.forEach(
        addMessageToScreen
      );
    }

    scrollToBottom();

  } catch (error) {

    console.error(
      "Unexpected message error:",
      error
    );
  }
}


// -----------------------------
// Display message
// -----------------------------

function addMessageToScreen(message) {

  const bubble =
    document.createElement("div");

  bubble.className =
    "message-bubble";


  if (
    currentUser &&
    message.user_id === currentUser.id
  ) {

    bubble.classList.add("mine");
  }


  const name =
    document.createElement("div");

  name.className =
    "message-name";

  name.textContent =
    message.family_members?.display_name ||
    "Family member";


  const text =
    document.createElement("div");

  text.textContent =
    message.message;


  const time =
    document.createElement("div");

  time.className =
    "message-time";

  time.textContent =
    new Date(
      message.created_at
    ).toLocaleString();


  bubble.appendChild(name);
  bubble.appendChild(text);
  bubble.appendChild(time);

  messagesContainer.appendChild(bubble);
}


// -----------------------------
// Send message
// -----------------------------

messageForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    const text =
      messageInput.value.trim();

    if (!text || !currentUser) {
      return;
    }

    messageInput.value = "";

    try {

      const result =
        await supabaseClient
          .from("messages")
          .insert({
            user_id: currentUser.id,
            message: text
          });


      if (result.error) {

        console.error(
          "Send message error:",
          result.error
        );

        alert(
          "Message could not be sent."
        );

        messageInput.value = text;
      }

    } catch (error) {

      console.error(
        "Unexpected send error:",
        error
      );

      alert(
        "Message could not be sent."
      );

      messageInput.value = text;
    }
  }
);


// -----------------------------
// Realtime messages
// -----------------------------

function subscribeToMessages() {

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }


  realtimeChannel =
    supabaseClient
      .channel("family-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        async function (payload) {

          try {

            const result =
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
                .eq(
                  "id",
                  payload.new.id
                )
                .single();


            if (
              !result.error &&
              result.data
            ) {

              addMessageToScreen(
                result.data
              );

              scrollToBottom();
            }

          } catch (error) {

            console.error(
              "Realtime message error:",
              error
            );
          }
        }
      )
      .subscribe();
}


// -----------------------------
// Scroll to bottom
// -----------------------------

function scrollToBottom() {

  messagesContainer.scrollTop =
    messagesContainer.scrollHeight;
}


// -----------------------------
// Logout
// -----------------------------

logoutButton.addEventListener(
  "click",
  async function () {

    if (realtimeChannel) {

      await supabaseClient.removeChannel(
        realtimeChannel
      );

      realtimeChannel = null;
    }

    await supabaseClient.auth.signOut();

    currentUser = null;

    emailInput.value = "";
    passwordInput.value = "";

    authMessage.textContent = "";

    showScreen(loginScreen);
  }
);


// -----------------------------
// Start application
// -----------------------------

async function startApp() {

  try {

    const result =
      await supabaseClient.auth.getSession();

    if (result.error) {

      console.error(
        "Session error:",
        result.error
      );

      showLogin();

      return;
    }


    const session =
      result.data.session;


    if (!session) {

      showScreen(loginScreen);

      return;
    }


    currentUser =
      session.user;

    await checkFamilyMembership();

  } catch (error) {

    console.error(
      "Startup error:",
      error
    );

    showLogin();
  }
}


// -----------------------------
// Start
// -----------------------------

startApp();
```
