import axios from 'axios';

interface UrlContent {
  url: string;
  title: string;
  description: string;
  content: string;
  thumbnail: string;
  lastFetched: string;
}

// List of CORS proxies to try
const CORS_PROXIES = [
  'https://api.allorigins.win/get?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://cors-anywhere.herokuapp.com/',
];

export const UrlFetchService = {
  async fetchUrlContent(url: string): Promise<UrlContent> {
    let lastError: Error | null = null;

    // Try each proxy in sequence until one works
    for (const proxyUrl of CORS_PROXIES) {
      try {
        console.log(`Trying to fetch URL with proxy: ${proxyUrl}`);
        
        // Construct the proxied URL
        const proxiedUrl = `${proxyUrl}${encodeURIComponent(url)}`;
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle different proxy response formats
        let html: string;
        if (proxyUrl.includes('allorigins')) {
          const data = await response.json();
          html = data.contents;
        } else {
          html = await response.text();
        }

        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract metadata with fallbacks
        const title = 
          doc.title || 
          doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
          doc.querySelector('meta[name="title"]')?.getAttribute('content') ||
          url.split('/').pop() || 'Untitled';

        const description = 
          doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
          doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
          doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
          '';

        const thumbnail = 
          doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
          doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
          '';

        // Extract main content with better targeting
        let content = '';
        
        // Try to find main content container
        const mainContent = 
          doc.querySelector('main') ||
          doc.querySelector('article') ||
          doc.querySelector('[role="main"]') ||
          doc.body;

        if (mainContent) {
          // Remove script tags, style tags, and comments
          const scripts = mainContent.getElementsByTagName('script');
          const styles = mainContent.getElementsByTagName('style');
          Array.from(scripts).forEach(script => script.remove());
          Array.from(styles).forEach(style => style.remove());

          // Get text content and clean it up
          content = mainContent.textContent || '';
          content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
        }

        // Return the successfully fetched content
        return {
          url,
          title,
          description,
          content: content.substring(0, 5000), // Limit content length
          thumbnail,
          lastFetched: new Date().toISOString()
        };

      } catch (error) {
        console.error(`Error fetching URL with proxy ${proxyUrl}:`, error);
        lastError = error as Error;
        continue; // Try next proxy
      }
    }

    // If we get here, all proxies failed
    throw new Error(lastError?.message || 'Failed to fetch URL content after trying all proxies');
  }
}; 