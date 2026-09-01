# SAGI Backend Development Checklist

Scope: backend/API work only. This excludes UI work, coupons, automated tests/UAT, distributor approval, automatic SKU generation, Supabase, brands, returns, damaged orders, average delivery-time reporting, Meta Pixel, and Microsoft Clarity.

## Foundation

- [x] Express and TypeScript backend setup
- [x] Git repository and project structure
- [x] PostgreSQL and Prisma database schema
- [x] Authentication
- [x] Admin and Customer roles
- [x] Environment configuration

## Product and inventory

- [x] Products
- [x] Categories and category API
- [x] Product variants
- [x] Inventory management and stock adjustments
- [x] Stock reservation and release during Stripe Checkout
- [x] Cloudinary signed product-image upload integration
- [x] Product search
- [x] Product filtering, sorting, and pagination
- [x] Admin product update, archive, and delete APIs

## Customer and orders

- [x] Product list and product-detail APIs
- [x] Shopping cart API
- [x] Customer profile API
- [x] Wishlist API
- [x] Order creation
- [x] Customer order history
- [x] Order-status management
- [x] Stripe Checkout integration
- [x] Stripe payment verification and webhooks
- [x] Customer addresses attached to orders
- [x] Shipping methods, delivery price, and carrier integration via Shippo (tracking excluded)
- [x] Admin-managed Canadian ship-from address and free-shipping threshold settings
- [ ] Canadian tax calculation
- [ ] Invoice generation, download, and email

## Reviews and email

- [x] Email verification
- [x] Delivery-triggered experience-review email
- [x] Customer experience-review submission
- [ ] Product review submission API
- [ ] Product review moderation/approval API
- [ ] Product review display API

## Administration and reporting APIs

- [x] Admin inventory adjustment
- [x] Admin transaction and payment investigation
- [x] Stripe-event inspection
- [x] Encrypted database backups
- [x] Sales report APIs: revenue, orders, average order value, and units sold
- [x] Product-performance report APIs: best seller and worst seller
- [x] Inventory report APIs
- [ ] Customer report APIs: new and returning customers
- [x] Review report APIs: reviews received and average rating
- [x] Order-operation report APIs: awaiting shipment and delivered orders
- [ ] Stripe refund action/API

## Analytics and production

- [ ] Google Analytics 4 integration
- [ ] Analytics-report ingestion/API: visitors, conversion rate, and traffic sources
- [ ] Production deployment configuration
- [ ] Production environment and secret-management setup
- [ ] Error monitoring and alerting
- [ ] Performance optimization pass
- [ ] Production security review
