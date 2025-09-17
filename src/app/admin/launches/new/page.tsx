import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Calendar, 
  Vote,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

async function getAvailableApps() {
  const { db } = await connectToDatabase();
  
  // Get apps that could be included in launches
  const apps = await db.collection('userapps')
    .find({})
    .sort({ totalVotes: -1 })
    .toArray();

  return apps.map(app => ({
    ...app,
    _id: app._id.toString(),
    totalVotes: app.totalVotes || 0,
    launchDate: app.launchDate || null
  }));
}

export default async function NewLaunchPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login');
  }

  const availableApps = await getAvailableApps();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Create New Launch</h2>
          <p className="text-muted-foreground">
            Set up a new voting launch with selected apps
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Launch Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Launch Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="launch-date">Launch Date</Label>
              <Input
                id="launch-date"
                type="date"
                defaultValue={today}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Date when the voting launch will be active
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="launch-name">Launch Name (Optional)</Label>
              <Input
                id="launch-name"
                placeholder="e.g., Weekly Product Hunt"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Custom name for this launch (defaults to date)
              </p>
            </div>

            <div className="space-y-3">
              <Label>Launch Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="auto-flush" defaultChecked />
                  <Label htmlFor="auto-flush" className="text-sm">
                    Auto-flush votes at end of day
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="send-notifications" />
                  <Label htmlFor="send-notifications" className="text-sm">
                    Send launch notifications
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="allow-late-votes" />
                  <Label htmlFor="allow-late-votes" className="text-sm">
                    Allow votes after launch end
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Launch Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Launch Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Launch Date</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(today).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Selected Apps</span>
                <Badge variant="secondary">0 selected</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Select apps from the list below to include in this launch
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Launch Rules</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• Each user can vote once per app</li>
                <li>• Votes expire after 25 hours</li>
                <li>• Launch auto-flushes at midnight</li>
                <li>• Results are immediately visible</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* App Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5" />
            Select Apps for Launch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Choose which apps will be included in this voting launch
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Select All
                </Button>
                <Button variant="outline" size="sm">
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {availableApps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Vote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No apps available for launch</p>
                  <p className="text-xs">Add apps to your system first</p>
                </div>
              ) : (
                availableApps.map((app: any) => (
                  <div key={app._id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                    <Checkbox id={`app-${app._id}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor={`app-${app._id}`} className="font-medium cursor-pointer">
                            {app.name || `App ${app._id.slice(-6)}`}
                          </Label>
                          {app.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {app.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {app.totalVotes} votes
                          </Badge>
                          {app.launchDate && (
                            <Badge variant="secondary" className="text-xs">
                              Scheduled: {new Date(app.launchDate).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline">
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button variant="outline">
            Save as Draft
          </Button>
          <Button>
            <CheckCircle className="mr-2 h-4 w-4" />
            Create Launch
          </Button>
        </div>
      </div>
    </div>
  );
}
