require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();

// Connect to MongoDB 
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/men_clothing_emporium', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define product schema
const productSchema = new mongoose.Schema({
  category: String,
  name: String,
  price: Number
});

// Define cart schema
const cartSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: { type: Number, default: 1 },
  addedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);
const Cart = mongoose.model('Cart', cartSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Set view engine to EJS
app.set('view engine', 'ejs');

// GET route to display products and cart
app.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    
    // Get cart items with product details
    const cartItems = await Cart.find().populate('productId');
    
    // Calculate total using MongoDB aggregation
    const cartTotal = await Cart.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          total: { 
            $sum: { 
              $multiply: ['$product.price', '$quantity'] 
            } 
          }
        }
      }
    ]);
    
    const totalPrice = cartTotal.length > 0 ? cartTotal[0].total : 0;
    
    res.render('index', { products, cartItems, totalPrice });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// POST route to add product
app.post('/add-product', async (req, res) => {
  try {
    const { category, name, price } = req.body;
    const product = new Product({ category, name, price });
    await product.save();
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding product');
  }
});

// GET route to edit product form
app.get('/edit-product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.render('edit', { product });
  } catch (error) {
    console.error(error);
    res.redirect('/');
  }
});

// POST route to update product
app.post('/update-product/:id', async (req, res) => {
  try {
    const { category, name, price } = req.body;
    await Product.findByIdAndUpdate(req.params.id, {
      category,
      name,
      price
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error updating product');
  }
});

// POST route to delete product
app.post('/delete-product/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    // Also remove from cart if exists
    await Cart.deleteMany({ productId: req.params.id });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error deleting product');
  }
});

// POST route to add item to cart
app.post('/add-to-cart/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check if item already in cart
    const existingItem = await Cart.findOne({ productId });
    
    if (existingItem) {
      // Increment quantity if already in cart
      existingItem.quantity += 1;
      await existingItem.save();
    } else {
      // Add new item to cart
      const cartItem = new Cart({ productId });
      await cartItem.save();
    }
    
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding to cart');
  }
});

// POST route to remove item from cart
app.post('/remove-from-cart/:id', async (req, res) => {
  try {
    await Cart.findByIdAndDelete(req.params.id);
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error removing from cart');
  }
});

// POST route to clear entire cart
app.post('/clear-cart', async (req, res) => {
  try {
    await Cart.deleteMany({});
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error clearing cart');
  }
});

// ====== API ENDPOINTS ======
// API: Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Create product
app.post('/api/products', async (req, res) => {
  try {
    const { category, name, price } = req.body;
    
    if (!category || !name || !price) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all fields'
      });
    }
    
    const product = new Product({ category, name, price });
    await product.save();
    
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Also remove from carts
    await Cart.deleteMany({ productId: req.params.id });
    
    res.json({
      success: true,
      data: {},
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Get cart with total
app.get('/api/cart', async (req, res) => {
  try {
    const cartItems = await Cart.find().populate('productId');
    
    const cartTotal = await Cart.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          total: { 
            $sum: { 
              $multiply: ['$product.price', '$quantity'] 
            } 
          }
        }
      }
    ]);
    
    const totalPrice = cartTotal.length > 0 ? cartTotal[0].total : 0;
    
    res.json({
      success: true,
      count: cartItems.length,
      total: totalPrice,
      data: cartItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// API: Search products by category
app.get('/api/products/search/:category', async (req, res) => {
  try {
    const products = await Product.find({ 
      category: req.params.category 
    });
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Serve static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});