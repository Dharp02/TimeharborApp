import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Clipboard } from '@capacitor/clipboard';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyText(text: string) {
  try {
    // Try Capacitor Clipboard first
    await Clipboard.write({
      string: text
    });
    return true;
  } catch (error) {
    console.warn('Capacitor Clipboard failed, trying navigator.clipboard', error);
    
    try {
      // Try modern Web Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error('navigator.clipboard not available');
    } catch (webError) {
      console.warn('navigator.clipboard failed, trying execCommand', webError);
      
      // Fallback to legacy execCommand
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure it's not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) return true;
        throw new Error('execCommand failed');
      } catch (execError) {
        console.error('All copy methods failed', execError);
        return false;
      }
    }
  }
}

export const enhanceTicketData = (rawTicket: any) => {
  const dateStr = rawTicket.lastWorkedOn;
  let formattedDate = 'Recently';
  
  if (dateStr) {
    try {
      formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
    } catch (e) {
      formattedDate = dateStr;
    }
  }

  return {
    ...rawTicket,
    status: rawTicket.status || 'In Progress',
    timeSpent: formattedDate,
    references: rawTicket.references || []
  };
};
