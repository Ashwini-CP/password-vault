// Simple AI-like functions (no backend required)

export function aiEvaluateStrength(password) {
  if (!password) return { strength: "Weak", suggestion: "Enter a password" };

  let score = 0;

  if (password.length > 6) score++;
  if (password.length > 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  let strength = "Weak";
  let suggestion = "Add length & special chars";

  if (score >= 4) {
    strength = "Strong";
    suggestion = "Good! This password is secure.";
  } else if (score === 3) {
    strength = "Medium";
    suggestion = "Add more symbols or numbers.";
  }

  return { strength, suggestion };
}

export function aiSuggestPassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let pass = "";
  for (let i = 0; i < 16; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export function aiCheckAnomaly() {
  // Very simple anomaly detection logic for demonstration
  const random = Math.random();

  if (random < 0.05) return "HIGH RISK"; // 5% chance
  if (random < 0.2) return "MODERATE RISK";

  return "LOW RISK";
}
