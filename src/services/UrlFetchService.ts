import axios from 'axios';
import { JSDOM } from 'jsdom';

export interface UrlMetadata {
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  content?: string;
  lastFetched?: number;
}

class UrlFetchService {
  private static instance: UrlFetchService;
  private cache: Map<string, UrlMetadata>;
  private cacheExpiry: number = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): UrlFetchService {
    if (!UrlFetchService.instance) {
      UrlFetchService.instance = new UrlFetchService();
    }
    return UrlFetchService.instance;
  }

  public async fetchUrl(url: string, forceRefresh: boolean = false): Promise<UrlMetadata> {
    // Check cache first if not forcing refresh
    if (!forceRefresh) {
      const cachedData = this.cache.get(url);
      if (cachedData && Date.now() - (cachedData.lastFetched || 0) < this.cacheExpiry) {
        console.log('UrlFetchService: Returning cached data for', url);
        return cachedData;
      }
    }

    console.log('UrlFetchService: Fetching URL', url);
    
    try {
      // Validate URL
      const validatedUrl = this.validateUrl(url);
      
      // Fetch the URL content
      const response = await axios.get(validatedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000, // 10 seconds timeout
      });

      // Parse the HTML content
      const metadata = this.parseHtml(validatedUrl, response.data);
      
      // Update cache
      this.cache.set(url, metadata);
      
      return metadata;
    } catch (error) {
      console.error('UrlFetchService: Error fetching URL', url, error);
      throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      // Ensure protocol is http or https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
      return parsedUrl.toString();
    } catch (error) {
      // If URL is invalid, try prepending https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return this.validateUrl(`https://${url}`);
      }
      throw new Error('Invalid URL');
    }
  }

  private parseHtml(url: string, html: string): UrlMetadata {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Extract metadata
    const title = document.querySelector('title')?.textContent || '';
    
    // Try to get description from meta tags
    let description = '';
    const metaDescription = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (metaDescription) {
      description = metaDescription.getAttribute('content') || '';
    } else if (ogDescription) {
      description = ogDescription.getAttribute('content') || '';
    }
    
    // Try to get thumbnail from meta tags
    let thumbnail = '';
    const ogImage = document.querySelector('meta[property="og:image"]');
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (ogImage) {
      thumbnail = ogImage.getAttribute('content') || '';
    } else if (twitterImage) {
      thumbnail = twitterImage.getAttribute('content') || '';
    }
    
    // If thumbnail is a relative URL, convert to absolute
    if (thumbnail && !thumbnail.startsWith('http')) {
      const baseUrl = new URL(url);
      thumbnail = new URL(thumbnail, baseUrl.origin).toString();
    }
    
    // Extract main content (simplified approach)
    const mainContent = document.querySelector('main') || 
                        document.querySelector('article') || 
                        document.querySelector('.content') || 
                        document.querySelector('#content');
    
    let content = '';
    if (mainContent) {
      content = mainContent.textContent || '';
    } else {
      // Fallback to body content with some cleaning
      const body = document.querySelector('body');
      if (body) {
        // Remove script and style elements
        Array.from(body.querySelectorAll('script, style, nav, footer, header')).forEach(el => el.remove());
        content = body.textContent || '';
      }
    }
    
    // Clean up content
    content = content.replace(/\s+/g, ' ').trim();
    
    return {
      url,
      title,
      description,
      thumbnail,
      content,
      lastFetched: Date.now(),
    };
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const urlFetchService = UrlFetchService.getInstance();
