# SUMUKH — Online Store Management

The Express server uses MongoDB Atlas as the persistent data store for shops, products, customers, and orders.

## Run locally

From the project folder:

```powershell
cd backend
npm install
npm start
```

Open [http://localhost:3000/index.html](http://localhost:3000/index.html). The server also hosts the frontend, so the dashboard and storefront use the same API automatically.

## Connected frontend flows

- Owner registration and sign-in
- Store profile/settings
- Product add, edit, stock toggle, and delete
- Customer add and customer records created from orders
- Manual and storefront checkout orders
- Order status changes and customer order tracking
