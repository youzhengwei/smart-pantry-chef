import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getProducts,
  createProduct
} from '@/services/firebaseService';
import { InventoryItem, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Refrigerator,
  Snowflake,
  Archive,
  Package,
  Search,
  ScanBarcode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import InventoryImageUpload from '@/components/InventoryImageUpload';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ------------------------- STATE -------------------------
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<'all' | 'fridge' | 'freezer' | 'pantry'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog control
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductSelectOpen, setIsProductSelectOpen] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [previousInventoryCount, setPreviousInventoryCount] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | 'new' | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Barcode scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Inventory form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    quantity: 1,
    quantityUnit: 'pcs',
    expiryDate: new Date().toISOString().split('T')[0],
    storage: 'fridge' as 'fridge' | 'freezer' | 'pantry',
    reorderThreshold: 2,
    defaultShelfLifeDays: undefined as number | undefined
  });

  // ------------------------- MEMO: PRODUCT FILTER -------------------------
  const userProducts = products.filter(
    (p) => p.source === 'manual' || p.createdBy === user?.uid
  );

  // ------------------------- RESET FORM -------------------------
  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      category: '',
      quantity: 1,
      quantityUnit: 'pcs',
      expiryDate: new Date().toISOString().split('T')[0],
      storage: 'fridge',
      reorderThreshold: 2,
      defaultShelfLifeDays: undefined
    });
    setEditingItem(null);
    setSelectedProductId(null);
  };

  // ------------------------- LOAD DATA -------------------------
  useEffect(() => {
    if (user) loadInventory();
  }, [user]);

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  const loadInventory = async () => {
    try {
      const items = await getInventory(user!.uid);
      setInventory(items);
    } catch (error) {
      toast({
        title: 'Error loading inventory',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const result = await getProducts(user!.uid);
      setProducts(result as Product[]);
    } catch (error) {
      console.error(error);
    }
  };

  // ------------------------- OPEN DIALOGS -------------------------
  const handleOpenDialog = (item?: InventoryItem) => {
    if (item) {
      // EDIT MODE
      setEditingItem(item);
      const expiryDate = item.expiryDate instanceof Timestamp
        ? item.expiryDate.toDate()
        : item.expiryDate;

      setFormData({
        name: item.name,
        brand: '',
        category: item.category,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        expiryDate: expiryDate.toISOString().split('T')[0],
        storage: item.storage,
        reorderThreshold: item.reorderThreshold ?? 2,
        defaultShelfLifeDays: undefined
      });

      setSelectedProductId(item.productId || null);
      setIsDialogOpen(true);
      return;
    }

    // ADD NEW MODE → show product selector first
    resetForm();
    setSelectedProduct(null);
    setIsProductSelectOpen(true);
  };

  // ------------------------- SAVE ITEM -------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in.',
        variant: 'destructive'
      });
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Item name is required.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.expiryDate) {
      toast({
        title: 'Validation Error',
        description: 'Expiry date is required.',
        variant: 'destructive'
      });
      return;
    }

    if (formData.quantity <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Quantity must be greater than 0.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      let productId: string | undefined = undefined;

      if (selectedProductId === 'new' || !selectedProductId) {
        // Create new product template
        const newId = await createProduct({
          name: formData.name,
          brand: formData.brand,
          category: formData.category,
          defaultShelfLifeDays: formData.defaultShelfLifeDays,
          source: 'manual',
          createdBy: user.uid
        });
        productId = newId;
        await loadProducts();
      } else {
        productId = selectedProductId;
      }

      const itemData = {
        userId: user.uid,
        productId: productId,
        name: formData.name,
        category: formData.category,
        quantity: formData.quantity,
        quantityUnit: formData.quantityUnit,
        expiryDate: Timestamp.fromDate(new Date(formData.expiryDate)),
        storage: formData.storage,
        reorderThreshold: formData.reorderThreshold ?? 2
      };

      if (editingItem) {
        await updateInventoryItem(editingItem.id!, itemData);
        toast({ 
          title: 'Item updated!',
          description: 'Your inventory has been updated successfully.'
        });
      } else {
        await addInventoryItem(itemData);
        toast({ 
          title: 'Item added!',
          description: 'New item added to your inventory.'
        });
      }

      await loadInventory();
      setIsDialogOpen(false);
      resetForm();

    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------- DELETE -------------------------
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteInventoryItem(id);
      await loadInventory();
      toast({ 
        title: 'Deleted',
        description: 'Item has been removed from your inventory.'
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error?.message || 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  // -------------------- BARCODE SCANNING --------------------
  useEffect(() => {
    if (!isScannerOpen) {
      // Scanner dialog is closed → clean up
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    // Only run in browser
    if (typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      try {
        const qrElement = document.getElementById('qr-reader');
        if (!qrElement) {
          console.warn('qr-reader element not found');
          return;
        }

        const scanner = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        const onScanSuccess = async (barcode: string) => {
          console.log('Barcode detected:', barcode);
          try {
            await scanner.clear();
          } catch (e) {
            console.warn('Error clearing scanner:', e);
          }
          scannerRef.current = null;
          setIsScannerOpen(false);
          await searchFoodDatabase(barcode);
        };

        const onScanError = (error: string) => {
          console.warn('QR error:', error);
        };

        scanner.render(onScanSuccess, onScanError);
        scannerRef.current = scanner;
      } catch (error) {
        console.error('Failed to initialize scanner:', error);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isScannerOpen]);

  const searchFoodDatabase = async (barcode: string) => {
  try {
    // OpenFoodFacts barcode lookup
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
    );
    const data = await response.json();

    // OpenFoodFacts uses status = 1 when product is found
    if (data.status === 1 && data.product) {
      const p = data.product;

      const name =
        p.product_name ||
        p.product_name_en ||
        p.generic_name ||
        'Unknown product';

      const brand =
        p.brands ||
        (Array.isArray(p.brands_tags) ? p.brands_tags[0] : '') ||
        '';

      // Take first category if available, else fallback
      let category = 'Other';
      if (p.categories_tags && p.categories_tags.length > 0) {
        // categories_tags look like "en:dairies", take the part after ":"
        const firstCat = p.categories_tags[0];
        category = firstCat.includes(':')
          ? firstCat.split(':')[1].replace(/-/g, ' ')
          : firstCat;
      } else if (p.categories) {
        // categories is a comma-separated string
        category = p.categories.split(',')[0].trim();
      }

      setFormData({
        name,
        brand,
        category,
        quantity: 1,
        quantityUnit: 'pcs',
        expiryDate: '',
        storage: 'fridge',
        reorderThreshold: 2,
        defaultShelfLifeDays: undefined, // you can later infer from category
      });

      // Treat as a new product template to be saved into your products collection
      setSelectedProductId('new');
      setIsDialogOpen(true);

      toast({
        title: 'Product found!',
        description: `${name}${brand ? ' by ' + brand : ''}`,
      });
    } else {
      toast({
        title: 'Product not found',
        description: 'This barcode is not in OpenFoodFacts. You can create a new item manually.',
        variant: 'destructive',
      });
      // Optional: directly open dialog with empty form for manual entry
      setSelectedProductId('new');
      resetForm();
      setIsDialogOpen(true);
    }
  } catch (error) {
    console.error('Food database search failed:', error);
    toast({
      title: 'Search failed',
      description: 'Could not reach OpenFoodFacts. Please try again or add manually.',
      variant: 'destructive',
    });
  }
};


  // -------------------- FILTERING --------------------
  const filteredInventory = inventory.filter(item => {
    const matchesFilter = filter === 'all' || item.storage === filter;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // ------------------------- HELPERS -------------------------
  const formatDate = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysUntilExpiry = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getStorageIcon = (s: string) => {
    switch (s) {
      case 'fridge': return <Refrigerator className="h-4 w-4" />;
      case 'freezer': return <Snowflake className="h-4 w-4" />;
      case 'pantry': return <Archive className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fresh': return <Badge className="status-fresh">Fresh</Badge>;
      case 'expiringSoon': return <Badge className="status-expiring">Expiring</Badge>;
      case 'almostExpired': return <Badge className="status-expired">Use Now</Badge>;
      default: return null;
    }
  };

  const getStorageStyle = (s: string) => {
    switch (s) {
      case 'fridge': return 'border-l-4 border-l-fridge';
      case 'freezer': return 'border-l-4 border-l-freezer';
      case 'pantry': return 'border-l-4 border-l-pantry';
      default: return '';
    }
  };

  // ------------------------- LOADING UI -------------------------
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ------------------------- RENDER -------------------------
  return (
    <div className="animate-fade-in space-y-6">
      {/* HEADER + DIALOGS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">Manage your kitchen inventory</p>
        </div>

        {/* PRODUCT SELECTION DIALOG */}
        <Dialog open={isProductSelectOpen} onOpenChange={setIsProductSelectOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 hidden">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>

          <DialogContent className="bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select a Product</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              {userProducts.map((prod) => (
                <Button
                  key={prod.id}
                  variant="ghost"
                  className="w-full flex flex-col items-start text-left border-b"
                  onClick={() => {
                    setIsProductSelectOpen(false);
                    setSelectedProduct(prod);
                    setSelectedProductId(prod.id);
                    setFormData({
                      name: prod.name,
                      brand: prod.brand || '',
                      category: prod.category || '',
                      quantity: 1,
                      quantityUnit: 'pcs',
                      expiryDate: '',
                      storage:
                        prod.defaultShelfLifeDays !== undefined ? 'fridge' : 'fridge',
                      reorderThreshold: 2,
                      defaultShelfLifeDays: prod.defaultShelfLifeDays
                    });
                    setIsDialogOpen(true);
                  }}
                >
                  <span className="font-semibold">{prod.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {prod.brand} · {prod.category}
                  </span>
                </Button>
              ))}

              {/* New Item */}
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  setIsProductSelectOpen(false);
                  resetForm();
                  setSelectedProduct(null);
                  setSelectedProductId('new');
                  setIsDialogOpen(true);
                }}
              >
                + New Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ADD/EDIT ITEM DIALOG */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Item' : selectedProduct ? 'Add Item' : 'Add New Item'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Only show product fields for new product creation */}
              {selectedProductId === 'new' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultShelfLifeDays">
                      Default Shelf Life (days)
                    </Label>
                    <Input
                      id="defaultShelfLifeDays"
                      type="number"
                      min="0"
                      value={formData.defaultShelfLifeDays ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultShelfLifeDays: Number(e.target.value)
                        })
                      }
                    />
                  </div>
                </>
              )}

              {/* ALWAYS show these */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.quantityUnit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, quantityUnit: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="pcs">pcs</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="pack">pack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Storage</Label>
                <Select
                  value={formData.storage}
                  onValueChange={(value: 'fridge' | 'freezer' | 'pantry') =>
                    setFormData({ ...formData, storage: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="fridge">
                      <div className="flex items-center gap-2">
                        <Refrigerator className="h-4 w-4 text-fridge" /> Fridge
                      </div>
                    </SelectItem>
                    <SelectItem value="freezer">
                      <div className="flex items-center gap-2">
                        <Snowflake className="h-4 w-4 text-freezer" /> Freezer
                      </div>
                    </SelectItem>
                    <SelectItem value="pantry">
                      <div className="flex items-center gap-2">
                        <Archive className="h-4 w-4 text-pantry" /> Pantry
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reorderThreshold">Low Stock Threshold</Label>
                <Input
                  id="reorderThreshold"
                  type="number"
                  min="0"
                  value={formData.reorderThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reorderThreshold: Number(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Notify when quantity falls below this threshold
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingItem ? (
                    'Update'
                  ) : (
                    'Add Item'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* BARCODE SCANNER MODAL */}
        <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan Barcode</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div id="qr-reader" className="w-full"></div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsScannerOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* IMAGE UPLOAD SECTION */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Add Items by Image</h2>
          <p className="text-muted-foreground">Upload a photo to detect items using AI</p>
        </div>
        <InventoryImageUpload
          onUploadStart={() => {
            setPreviousInventoryCount(inventory.length);
          }}
          onUploadComplete={async (success, errorMessage) => {
            if (success) {
              // Wait 15 seconds for processing
              await new Promise(resolve => setTimeout(resolve, 15000));
              
              // Reload inventory
              await loadInventory();
              
              // Check if items were added
              const newInventory = await getInventory(user!.uid);
              const currentCount = newInventory.length;
              if (currentCount > previousInventoryCount) {
                toast({
                  title: 'Success!',
                  description: `Added ${currentCount - previousInventoryCount} item${currentCount - previousInventoryCount !== 1 ? 's' : ''} to your inventory.`,
                });
              } else {
                toast({
                  title: 'No new items detected',
                  description: 'Try uploading a clearer photo or add items manually.',
                  variant: 'destructive',
                });
              }
            } else {
              toast({
                title: 'Failed to process image',
                description: errorMessage || 'Please try again.',
                variant: 'destructive',
              });
            }
          }}
        />
      </div>

      {/* FILTERS */}
      <Card className="magnet-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'fridge' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('fridge')}
              >
                <Refrigerator className="mr-1 h-4 w-4" /> Fridge
              </Button>
              <Button
                variant={filter === 'freezer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('freezer')}
              >
                <Snowflake className="mr-1 h-4 w-4" /> Freezer
              </Button>
              <Button
                variant={filter === 'pantry' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pantry')}
              >
                <Archive className="mr-1 h-4 w-4" /> Pantry
              </Button>
            </div>

            {/* Barcode scanner button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="gap-2"
            >
              <ScanBarcode className="h-4 w-4" />
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LIST */}
      {filteredInventory.length === 0 ? (
        <Card className="magnet-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 font-display text-xl font-semibold">No items</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try different search.' : 'Add your first item.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInventory.map((item) => (
            <Card
              key={item.id}
              className={cn('magnet-card overflow-hidden', getStorageStyle(item.storage))}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      {getStorageIcon(item.storage)}
                      <h3 className="font-display text-lg font-semibold">{item.name}</h3>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {getStatusBadge(item.status)}
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      {item.isLowStock && (
                        <Badge className="status-expiring text-xs">Low Stock</Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        Quantity:{' '}
                        <span className="font-medium text-foreground">
                          {item.quantity} {item.quantityUnit}
                        </span>
                      </p>

                      <p>
                        Expires:{' '}
                        <span
                          className={cn(
                            'font-medium',
                            getDaysUntilExpiry(item.expiryDate) <= 2
                              ? 'text-expired'
                              : getDaysUntilExpiry(item.expiryDate) <= 5
                              ? 'text-expiring'
                              : 'text-fresh'
                          )}
                        >
                          {formatDate(item.expiryDate)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inventory;
