import { InventoryItem } from '@/types';
import { Timestamp } from 'firebase/firestore';

// Convert image file to base64
export const imageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Send image to webhook for AI processing
export const addInventoryViaImage = async (
  userId: string,
  imageFile: File
): Promise<InventoryItem[]> => {
  const WEBHOOK_URL = 'https://n8ngc.codeblazar.org/webhook/add-inventory-image';

  try {
    const imageBase64 = await imageToBase64(imageFile);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        imageBase64
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const webhookData = await response.json();
    console.log('Webhook response:', webhookData);

    // Extract items array from response (webhook may return { items: [] } or direct array)
    let itemsArray: any[] = [];
    if (Array.isArray(webhookData)) {
      itemsArray = webhookData;
    } else if (webhookData && Array.isArray(webhookData.items)) {
      itemsArray = webhookData.items;
    } else if (webhookData && Array.isArray(webhookData.data)) {
      itemsArray = webhookData.data;
    } else if (webhookData && typeof webhookData === 'object') {
      // Try to find any array property in the response
      const firstArrayProp = Object.values(webhookData).find(v => Array.isArray(v));
      itemsArray = firstArrayProp as any[] || [];
    }

    // Transform webhook response to InventoryItem format
    const items: InventoryItem[] = itemsArray.map((item: any) => {
      // Parse expiry date if it's a string
      let expiryDate: Timestamp | Date;
      if (typeof item.expiryDate === 'string') {
        expiryDate = Timestamp.fromDate(new Date(item.expiryDate));
      } else if (item.expiryDate instanceof Timestamp) {
        expiryDate = item.expiryDate;
      } else {
        expiryDate = Timestamp.fromDate(new Date());
      }

      // Parse quantity
      const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity || 1;

      // Calculate status
      const status = calculateItemStatus(expiryDate);

      return {
        userId,
        name: item._name || item.name || 'Unknown Item',
        category: item.category || 'Uncategorized',
        quantity: quantity,
        quantityUnit: item.quantityUnit || item.unit || 'pcs',
        expiryDate,
        storage: item.storage || 'fridge' as 'fridge' | 'freezer' | 'pantry',
        reorderThreshold: 2,
        isLowStock: false,
        status,
        source: 'ai',
        createdAt: Timestamp.now()
      };
    });

    return items;
  } catch (error) {
    console.error('Inventory image webhook error:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
};

// Helper to calculate item status based on expiry date
export const calculateItemStatus = (expiryDate: Timestamp | Date): 'fresh' | 'expiringSoon' | 'almostExpired' => {
  const now = new Date();
  const expiry = expiryDate instanceof Timestamp ? expiryDate.toDate() : expiryDate;
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry <= 2) return 'almostExpired';
  if (daysUntilExpiry <= 5) return 'expiringSoon';
  return 'fresh';
};
