import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { googleSheetsService } from '../services/googleSheetsService';
import { syncService } from '../services/syncService';
import { toast } from 'sonner';

const Settings = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [autoSync, setAutoSync] = useState(syncService.isAutoSyncOn());
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('googleSheetsSettings');
    if (savedSettings) {
      const { url, email, key } = JSON.parse(savedSettings);
      setGoogleSheetUrl(url);
      setClientEmail(email);
      setPrivateKey(key);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  const extractSpreadsheetId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      const spreadsheetId = extractSpreadsheetId(googleSheetUrl);
      if (!spreadsheetId) {
        toast.error('Invalid Google Sheet URL');
        return;
      }

      await googleSheetsService.initialize({
        clientEmail,
        privateKey,
        spreadsheetId,
      });

      // Test the connection
      await googleSheetsService.getData();
      
      // Save settings to localStorage
      localStorage.setItem('googleSheetsSettings', JSON.stringify({
        url: googleSheetUrl,
        email: clientEmail,
        key: privateKey,
      }));

      // Update auto-sync setting
      syncService.setAutoSync(autoSync);
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Enter the admin password to access settings</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit">Login</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure your Google Sheets integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="sheetUrl">Google Sheet URL</Label>
              <Input
                id="sheetUrl"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientEmail">Service Account Email</Label>
              <Input
                id="clientEmail"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="service-account@project.iam.gserviceaccount.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="privateKey">Private Key</Label>
              <Input
                id="privateKey"
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="autoSync"
                checked={autoSync}
                onCheckedChange={setAutoSync}
              />
              <Label htmlFor="autoSync">Enable Auto Sync</Label>
            </div>
            <Button onClick={handleSaveSettings} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings; 