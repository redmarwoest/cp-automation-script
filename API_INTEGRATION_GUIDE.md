# API Integration Guide - Download Link Storage

This document explains what data the worker sends to your API and how to handle it to store download links in your database.

## Worker → API Request

When a poster is completed, the worker sends a POST request to `/api/worker-queue` with the following data:

```json
{
  "action": "complete",
  "queueId": "queue-item-id",
  "posterPath": "/Users/redmarwoest/course-prints/exports/ORDER_xxx_poster.pdf",
  "fileName": "ORDER_xxx_poster.pdf",
  "orderId": "order-xxx",
  "merchandiseId": "merchandise-xxx",
  "downloadLink": "https://your-pullzone.b-cdn.net/posters/order-xxx/ORDER_xxx_poster.pdf",
  "bunnyCDN": {
    "filePath": "posters/order-xxx/ORDER_xxx_poster.pdf",
    "downloadLink": "https://your-pullzone.b-cdn.net/posters/order-xxx/ORDER_xxx_poster.pdf",
    "storageZone": "cp-prints"
  }
}
```

**Note:** The `downloadLink` and `bunnyCDN` fields are only included if the BunnyCDN upload was successful.

## API Endpoint Requirements

Your API endpoint (`/api/worker-queue` with `action: "complete"`) needs to:

### 1. Update the Queue Item

Mark the queue item as completed and store the download link:

```typescript
// Update queue item
await QueueItemModel.findOneAndUpdate(
  { _id: queueId },
  {
    status: 'completed',
    downloadLink: downloadLink, // Store at queue item level
    completedAt: new Date(),
    posterPath: posterPath,
    fileName: fileName,
  }
);
```

### 2. Update the Order

Update the order's metadata to include the download link:

```typescript
// Update order metadata
await OrderModel.findOneAndUpdate(
  { orderId: orderId }, // or { _id: orderId } depending on your schema
  {
    $set: {
      'metadata.orderDownloadLink': downloadLink, // Order-level download link
      'metadata.posterGenerated': true,
      'metadata.posterPath': posterPath,
      updatedAt: new Date(),
    }
  }
);
```

### 3. Update the Order Item (Optional)

If you want item-level download links, update the specific order item:

```typescript
// Update specific order item
await OrderModel.findOneAndUpdate(
  { 
    orderId: orderId,
    'items.merchandiseId': merchandiseId 
  },
  {
    $set: {
      'items.$.downloadLink': downloadLink, // Item-level download link
      updatedAt: new Date(),
    }
  }
);
```

## Complete Example Implementation

Here's a complete example of what your API endpoint should look like:

```typescript
// api/worker-queue.ts (Next.js API route example)

import type { NextApiRequest, NextApiResponse } from 'next';
import { connectDB } from '@/lib/mongodb';
import QueueItem from '@/models/QueueItem';
import Order from '@/models/Order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, queueId, orderId, merchandiseId, downloadLink, posterPath, fileName } = req.body;

  if (action === 'complete') {
    try {
      await connectDB();

      // 1. Update queue item
      await QueueItem.findByIdAndUpdate(
        queueId,
        {
          status: 'completed',
          downloadLink: downloadLink,
          completedAt: new Date(),
          posterPath: posterPath,
          fileName: fileName,
        }
      );

      // 2. Update order metadata (order-level download link)
      if (downloadLink && orderId) {
        await Order.findOneAndUpdate(
          { orderId: orderId },
          {
            $set: {
              'metadata.orderDownloadLink': downloadLink,
              'metadata.posterGenerated': true,
              'metadata.posterPath': posterPath,
              updatedAt: new Date(),
            }
          }
        );

        // 3. Update specific order item (item-level download link)
        if (merchandiseId) {
          await Order.findOneAndUpdate(
            { 
              orderId: orderId,
              'items.merchandiseId': merchandiseId 
            },
            {
              $set: {
                'items.$.downloadLink': downloadLink,
                updatedAt: new Date(),
              }
            }
          );
        }
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error completing queue item:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Handle other actions...
}
```

## Database Schema Notes

Based on your TypeScript interfaces:

- **Order**: Store `downloadLink` in `metadata.orderDownloadLink`
- **OrderItem**: Store `downloadLink` in `items[].downloadLink` (optional, for item-level links)
- **QueueItem**: Store `downloadLink` in the queue item document

## Testing

To test if the download link is being stored correctly:

1. Generate a poster (the worker will upload it to BunnyCDN)
2. Check your database:
   - Order document should have `metadata.orderDownloadLink` set
   - Order item should have `downloadLink` set (if item-level links are implemented)
   - Queue item should have `downloadLink` set

## Error Handling

If the BunnyCDN upload fails, the worker will still send the completion request but without the `downloadLink` field. Your API should:

- Still mark the queue item as completed
- Log an error or warning
- Optionally set a flag like `metadata.posterGenerationFailed: true`

