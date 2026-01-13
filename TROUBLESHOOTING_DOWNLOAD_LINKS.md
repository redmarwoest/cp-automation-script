# Troubleshooting: Download Links Not Showing

If download links aren't showing up when you rerun an order, check the following:

## 1. Verify Worker is Sending Download Link

Check the worker logs to confirm the download link is being sent:

```bash
tail -f ~/Library/Logs/courseprints.out.log
```

Look for lines like:
- `☁️ BunnyCDN download link: https://...`
- `📤 Sending download link to API for order: ...`
- `📤 Sending completion request to API with data: ...`

If you see `⚠️ No download link available`, the BunnyCDN upload failed. Check:
- Environment variables are set (`.env` file)
- `BUNNYCDN_STORAGE_ZONE_NAME=cp-prints`
- `BUNNYCDN_STORAGE_ACCESS_KEY=your-key`
- `BUNNYCDN_PULL_ZONE_URL=https://your-pullzone.b-cdn.net` (optional but recommended)

## 2. Verify API is Receiving the Download Link

Check your API logs (Vercel/your hosting platform) for the `/api/worker-queue` endpoint when `action: "complete"` is called.

The API should receive:
```json
{
  "action": "complete",
  "queueId": "...",
  "orderId": "...",
  "merchandiseId": "...",
  "downloadLink": "https://...",
  "posterPath": "...",
  "fileName": "..."
}
```

## 3. Verify API is Storing the Download Link

Your API endpoint needs to update **both** the queue item AND the order:

### Update Queue Item
```typescript
await QueueItem.findByIdAndUpdate(queueId, {
  status: 'completed',
  downloadLink: downloadLink, // ← Make sure this is being set
  // ...
});
```

### Update Order Metadata
```typescript
await Order.findOneAndUpdate(
  { orderId: orderId },
  {
    $set: {
      'metadata.orderDownloadLink': downloadLink, // ← This is what the frontend needs
      'metadata.posterGenerated': true,
      updatedAt: new Date(),
    }
  }
);
```

## 4. Common Issues When Rerunning Orders

### Issue: Download Link Not Overwritten
When rerunning an order, the API should **update** the existing order's `metadata.orderDownloadLink`, not create a new one.

**Solution:** Use `findOneAndUpdate` with `$set` to overwrite the existing download link.

### Issue: Using `$push` Instead of `$set`
If you're using `$push` for arrays, make sure you're using `$set` for the download link field.

### Issue: Order Query Not Matching
Make sure your query matches the order correctly:
- Use `{ orderId: orderId }` if `orderId` is a string field
- Use `{ _id: orderId }` if `orderId` is the MongoDB `_id`

### Issue: Metadata Field Not Existing
If `metadata` doesn't exist on the order, MongoDB should create it automatically with `$set`, but make sure you're not getting schema validation errors.

## 5. Verify Database Has the Download Link

Query your database directly to check if the download link is stored:

```javascript
// MongoDB query
db.orders.findOne({ orderId: "your-order-id" }, { "metadata.orderDownloadLink": 1 })

// Should return:
{
  "metadata": {
    "orderDownloadLink": "https://your-pullzone.b-cdn.net/posters/order-xxx/file.pdf"
  }
}
```

## 6. Verify Frontend is Displaying the Download Link

Check your frontend code that displays the order details:

1. Is it reading from `order.metadata.orderDownloadLink`?
2. Is it checking if the field exists before displaying?
3. Is it re-fetching the order data after poster generation?

## 7. Debug Checklist

- [ ] Worker logs show download link is being sent
- [ ] API logs show download link is being received
- [ ] API code updates `metadata.orderDownloadLink` (not just queue item)
- [ ] Database query shows `metadata.orderDownloadLink` exists
- [ ] Frontend reads from `order.metadata.orderDownloadLink`
- [ ] Order data is refreshed after poster generation completes

## Quick Test

To quickly test if the API is working:

1. Generate a poster (rerun an order)
2. Check worker logs: `tail -20 ~/Library/Logs/courseprints.out.log`
3. Check your database directly for the order's `metadata.orderDownloadLink`
4. If it's in the database but not showing in UI, the issue is in the frontend
5. If it's not in the database, the issue is in the API endpoint

