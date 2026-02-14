# 🎮 Demo Mode - Quick Start Guide

## What is Demo Mode?

Demo mode allows you to explore the **Sales Template Auto Updater** application without setting up Supabase. It uses pre-loaded sample data extracted from your actual CSV files.

## How to Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

3. **Login with demo credentials:**
   - **Admin Access:** 
     - Username: `admin`
     - Password: `demo`
   
   - **User Access:**
     - Username: `user`
     - Password: `demo`

## What You Can Do in Demo Mode

### As Admin
✅ View pre-loaded SKU mappings (10 sample mappings from your data)  
✅ See user management interface  
✅ Explore distributor reports section  
✅ Navigate through all admin features  

**Note:** In demo mode, admin actions (create user, add mappings, etc.) will appear to work but won't persist after refresh.

### As User
✅ See the complete user dashboard  
✅ Explore the file upload interface  
✅ View the DS-to-SURVEYOR mapping workflow  
✅ See upload history UI  

**Note:** File uploads in demo mode will simulate the process but won't actually process files.

## Sample Data Included

The demo mode includes real data from your files:

### SKU Mappings (10 samples)
- `BNC CHOC TWST RS10` → `Classic RT`
- `BNC ORNG MST MRP10` → `Classic Double Burst`
- `MAGICMASALARS10` → `Uni Klov Sleeks`
- `SFFNTSTKALMONDRS10` → `AC L.I.T.`
- And 6 more...

### DS Names & Surveyors (6 samples)
- `RUSHIKESH-9321844072-KASHIWALE` → `VIVEK (VMC)`
- `DHIRAJ PCP-9867213346` → `RAJESH JAISWAL (VMC)`
- `MANISH - 8779142295   PAYAL -9321848735` → `SANDEEP GUPTA (VMC)`
- And 3 more...

### Sales Data (10 sample transactions)
Real transactions from your sales file showing various DS names, Market SKUs, and quantities.

## Limitations of Demo Mode

❌ **No data persistence** - All changes are lost on page refresh  
❌ **No file processing** - File uploads are simulated only  
❌ **No database** - All data is stored in browser memory  
❌ **No real authentication** - Simple username/password check  

## Switching to Production Mode

When you're ready to use the full application:

1. **Set up Supabase** - Follow instructions in `SETUP_GUIDE.md`
2. **Configure `.env`** - Add your Supabase credentials
3. **Update `authStore.ts`** - Change `demoMode: true` to `demoMode: false`
4. **Restart the server** - Run `npm run dev` again

## Demo Mode Features

### What Works
- ✅ Login/logout
- ✅ Role-based routing (admin vs user)
- ✅ UI navigation
- ✅ View sample data
- ✅ Explore all interfaces

### What's Simulated
- 🔄 File uploads (shows UI but doesn't process)
- 🔄 Data creation (appears to work but doesn't persist)
- 🔄 Data updates (changes lost on refresh)

## Troubleshooting

**Q: I see a blank screen**  
A: Make sure `npm run dev` is running and navigate to http://localhost:3000

**Q: Login doesn't work**  
A: Use exact credentials: `admin/demo` or `user/demo` (case-sensitive)

**Q: My changes disappeared**  
A: This is expected in demo mode. All data is in memory and resets on refresh.

**Q: Can I upload real files?**  
A: In demo mode, file uploads are simulated. For real file processing, set up Supabase.

## Next Steps

1. **Explore the UI** - Click around and see all features
2. **Review the code** - Check `src/stores/authStore.ts` for demo logic
3. **Read the docs** - See `README.md` for full documentation
4. **Set up production** - Follow `SETUP_GUIDE.md` when ready

---

**Enjoy exploring the application! 🚀**
