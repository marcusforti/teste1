const config = {
  appName: "Open AI UGC",
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    webhook_url: process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    plans: {
      basic:    { id: "basic",    name: "Basic Pack",        credits: 1000,  price: 500   },
      standard: { id: "standard", name: "Standard Pack",     credits: 2000,  price: 1000  },
      pro:      { id: "pro",      name: "Professional Pack", credits: 4000,  price: 2000  },
      business: { id: "business", name: "Business Pack",     credits: 10000, price: 5000  },
    },
  },
  ai: {
    apiKey: process.env.MUAPIAPP_API_KEY,
    generationCost: 10,
    model: "gpt-4o",
  },
  // Clone Studio: photos -> portrait -> (voice clone) -> script TTS -> talking video.
  clone: {
    endpoints: {
      portrait: "nano-banana-edit",
      scene: "nano-banana-edit",
      voiceClone: "minimax-voice-clone",
      tts: "minimax-speech-2.6-hd",
      talk: "infinitetalk-image-to-video",
    },
    // App credits per step (ignored when the user brings their own MuAPI key).
    costs: { portrait: 20, scene: 20, voiceClone: 100, tts: 10, talk: 300 },
    maxPhotos: 6,
    maxScriptChars: 1500,
    presetVoices: [
      "Friendly_Person",
      "Casual_Guy",
      "Lively_Girl",
      "Calm_Woman",
      "Deep_Voice_Man",
      "Inspirational_girl",
      "Patient_Man",
      "Wise_Woman",
    ],
    emotions: ["happy", "neutral", "surprised", "sad", "angry", "fearful", "disgusted"],
    // MiniMax TTS speed (0.5–2.0). 0.77 ≈ speech 1.3× longer, closer to a natural speaking pace.
    speeds: [
      { value: 0.77, label: "Natural (1,3× mais longo)" },
      { value: 0.85, label: "Um pouco mais lento" },
      { value: 1, label: "Normal" },
      { value: 1.15, label: "Mais rápido" },
      { value: 1.3, label: "Rápido (1,3×)" },
    ],
    defaultSpeed: 0.77,
  },
};

export default config;
