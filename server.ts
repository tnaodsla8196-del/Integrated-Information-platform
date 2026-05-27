import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

  app.use(express.json());

  // Jandi Webhook Receiver
  app.post("/api/webhook/jandi", (req, res) => {
    console.log("Received Jandi Webhook:", req.body);
    // Here you would typically process the data (e.g. notify users, update sheet, etc.)
    res.json({ 
      status: "success", 
      message: "Webhook received",
      receivedData: req.body 
    });
  });

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google Sheet CSV Proxy to bypass CORS
  app.get("/api/employees", async (req, res) => {
    try {
      const spreadsheetId = '1kHoQPjudplszOtD39wnZHMHGAaEghTNkVuqNjNQf37o';
      const targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
      }
      const csvText = await response.text();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csvText);
    } catch (error: any) {
      console.error('Error proxying sheet data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
