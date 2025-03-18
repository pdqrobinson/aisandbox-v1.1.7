$compress = @{
  Path = "src", "server", "package.json", "package-lock.json", "tsconfig.json", "tsconfig.node.json", "vite.config.ts", "server.js", "nodemon.json", "index.html", "README.md", ".gitignore", "vercel.json"
  CompressionLevel = "Optimal"
  DestinationPath = "ai-sandbox-local.zip"
}
Compress-Archive @compress -Force 