const keyInput = document.getElementById("anonKey");
const saveBtn  = document.getElementById("save");
const status   = document.getElementById("status");

chrome.storage.local.get("supabaseAnonKey", ({ supabaseAnonKey }) => {
  if (supabaseAnonKey) keyInput.value = supabaseAnonKey;
});

saveBtn.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) { showStatus("Enter a key first.", true); return; }
  chrome.storage.local.set({ supabaseAnonKey: key }, () => {
    showStatus("Saved! Reload the PixiSet tab.");
  });
});

function showStatus(msg, isError = false) {
  status.textContent = msg;
  status.className = "status" + (isError ? " error" : "");
}
