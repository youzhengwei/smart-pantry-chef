import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getInventory, seedSampleData } from '@/services/firebaseService';
import { InventoryItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  ShoppingCart,
  Loader2,
  ChefHat,
  Refrigerator,
  Snowflake,
  Archive,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';


const Dashboard: React.FC = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [user]);

  const loadInventory = async () => {
    if (!user) return;
    try {
      const items = await getInventory(user.uid);
      setInventory(items);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedSampleData(user.uid);
      await loadInventory();
      toast({
        title: 'Sample data added!',
        description: 'Your kitchen has been stocked with sample items.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add sample data.',
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const totalItems = inventory.length;
  const expiringItems = inventory.filter(i => i.status === 'expiringSoon' || i.status === 'almostExpired');
  const lowStockItems = inventory.filter(i => i.isLowStock);
  const useSoonItems = inventory.filter(i => i.status === 'almostExpired');

  const formatDate = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return 'Expired';
    return `${diff} days`;
  };

  const getStorageIcon = (storage: string) => {
    switch (storage) {
      case 'fridge': return <Refrigerator className="h-4 w-4" />;
      case 'freezer': return <Snowflake className="h-4 w-4" />;
      case 'pantry': return <Archive className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'status-fresh';
      case 'expiringSoon': return 'status-expiring';
      case 'almostExpired': return 'status-expired';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Welcome back, {userData?.name || user?.displayName || 'Chef'}! 👋
          </h1>
          <p className="text-muted-foreground">Here's what's happening in your kitchen today.</p>
        </div>
        {inventory.length === 0 && (
          <Button onClick={handleSeedData} disabled={seeding} className="gap-2">
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Add Sample Data
              </>
            )}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Items"
          value={totalItems}
          icon={<Package className="h-5 w-5" />}
          color="primary"
          onClick={() => navigate('/inventory')}
        />
        <StatsCard
          title="Expiring Soon"
          value={expiringItems.length}
          icon={<Clock className="h-5 w-5" />}
          color="expiring"
          onClick={() => navigate('/inventory')}
        />
        <StatsCard
          title="Low Stock"
          value={lowStockItems.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="expired"
          onClick={() => navigate('/inventory')}
        />
        <StatsCard
          title="Recipe Ideas"
          value="View"
          icon={<ChefHat className="h-5 w-5" />}
          color="fresh"
          onClick={() => navigate('/recipes')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Use Soon Widget */}
        <Card className="magnet-card overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-expired/10 to-expiring/10">
            <CardTitle className="flex items-center gap-2 font-display">
              <Clock className="h-5 w-5 text-expired" />
              Use Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {useSoonItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fresh/10 text-fresh">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="text-muted-foreground">All items are fresh! Great job managing your kitchen.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {useSoonItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-expired/10 text-expired">
                        {getStorageIcon(item.storage)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.quantityUnit}
                        </p>
                      </div>
                    </div>
                    <Badge className={cn('text-xs', getStatusColor(item.status))}>
                      {formatDate(item.expiryDate)}
                    </Badge>
                  </div>
                ))}
                {useSoonItems.length > 4 && (
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => navigate('/inventory')}
                  >
                    View all {useSoonItems.length} items
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Widget */}
        <Card className="magnet-card overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-expiring/10 to-primary/10">
            <CardTitle className="flex items-center gap-2 font-display">
              <ShoppingCart className="h-5 w-5 text-expiring" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-fresh/10 text-fresh">
                  <Package className="h-8 w-8" />
                </div>
                <p className="text-muted-foreground">You're fully stocked! Nothing to reorder.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-expiring/10 text-expiring">
                        {getStorageIcon(item.storage)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Only {item.quantity} {item.quantityUnit} left
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate('/store-locator', { state: { searchItem: `${item.name} ${item.quantity} ${item.quantityUnit}` } })}
                    >
                      Find
                    </Button>
                  </div>
                ))}
                {lowStockItems.length > 4 && (
                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => navigate('/inventory')}
                  >
                    View all {lowStockItems.length} items
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="magnet-card">
        <CardHeader>
          <CardTitle className="font-display">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/inventory')}
            >
              <Package className="h-6 w-6" />
              <span>Add Item</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/recipes')}
            >
              <ChefHat className="h-6 w-6" />
              <span>Find Recipes</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/store-locator')}
            >
              <ShoppingCart className="h-6 w-6" />
              <span>Find Stores</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col gap-2 py-4"
              onClick={() => navigate('/saved-recipes')}
            >
              <Sparkles className="h-6 w-6" />
              <span>Saved Recipes</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'primary' | 'fresh' | 'expiring' | 'expired';
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, onClick }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    fresh: 'bg-fresh/10 text-fresh',
    expiring: 'bg-expiring/10 text-expiring',
    expired: 'bg-expired/10 text-expired',
  };

  return (
    <Card 
      className="magnet-card cursor-pointer transition-all hover:scale-[1.02]" 
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-6">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', colorClasses[color])}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="font-display text-2xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
