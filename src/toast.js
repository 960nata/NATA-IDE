// Toast notif global — panggil toast('pesan', 'success'|'error'|'info') dari mana aja.
export function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('nata-toast', { detail: { message, type, id: Date.now() + Math.random() } }));
}
