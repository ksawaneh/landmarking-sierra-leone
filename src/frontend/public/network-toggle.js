// Function to toggle network state
function toggleNetwork() {
  const status = document.getElementById('network-status');
  
  if (navigator.onLine) {
    // Force offline - dispatch events to simulate offline
    window.dispatchEvent(new Event('offline'));
    status.innerText = 'OFFLINE (Simulated)';
    status.style.backgroundColor = '#FEE2E2';
  } else {
    // Force online - dispatch events to simulate online
    window.dispatchEvent(new Event('online'));
    status.innerText = 'ONLINE';
    status.style.backgroundColor = '#D1FAE5';
  }
}

// Add network status indicator and toggle button
document.addEventListener('DOMContentLoaded', () => {
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.bottom = '20px';
  div.style.right = '20px';
  div.style.zIndex = '9999';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.alignItems = 'center';
  div.style.gap = '10px';
  div.style.padding = '10px';
  div.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  div.style.borderRadius = '8px';
  div.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  div.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  
  const title = document.createElement('div');
  title.innerText = 'Network Testing';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '12px';
  
  const status = document.createElement('div');
  status.id = 'network-status';
  status.innerText = navigator.onLine ? 'ONLINE' : 'OFFLINE';
  status.style.padding = '5px 10px';
  status.style.borderRadius = '5px';
  status.style.fontWeight = 'bold';
  status.style.fontSize = '12px';
  status.style.backgroundColor = navigator.onLine ? '#D1FAE5' : '#FEE2E2';
  status.style.color = navigator.onLine ? '#065F46' : '#991B1B';
  status.style.width = '100%';
  status.style.textAlign = 'center';
  
  const button = document.createElement('button');
  button.innerText = 'Toggle Network';
  button.style.padding = '5px 10px';
  button.style.borderRadius = '5px';
  button.style.backgroundColor = '#E0E7FF';
  button.style.border = 'none';
  button.style.cursor = 'pointer';
  button.style.fontSize = '12px';
  button.style.fontWeight = 'bold';
  button.style.color = '#3730A3';
  button.onclick = toggleNetwork;
  
  div.appendChild(title);
  div.appendChild(status);
  div.appendChild(button);
  document.body.appendChild(div);
  
  // Listen for actual network changes
  window.addEventListener('online', () => {
    status.innerText = 'ONLINE';
    status.style.backgroundColor = '#D1FAE5';
    status.style.color = '#065F46';
  });
  
  window.addEventListener('offline', () => {
    status.innerText = 'OFFLINE';
    status.style.backgroundColor = '#FEE2E2';
    status.style.color = '#991B1B';
  });
});