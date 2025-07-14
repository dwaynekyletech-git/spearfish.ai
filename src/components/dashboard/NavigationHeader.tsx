/**
 * Navigation Header Component
 * 
 * Top navigation bar with logo, menu items, and user profile
 */

import { UserButton } from '@clerk/nextjs';
import { CubeIcon } from '@heroicons/react/24/outline';

export function NavigationHeader() {
  return (
    <nav className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <CubeIcon className="h-8 w-8 text-purple-400 mr-3" />
            <h1 className="text-xl font-bold text-white">Spearfish AI</h1>
          </div>
          
          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-8">
              <a 
                href="/dashboard" 
                className="text-purple-300 hover:text-white transition-colors font-medium"
              >
                Companies
              </a>
              <a 
                href="#" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Startups
              </a>
              <a 
                href="#" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                Resources
              </a>
              <a 
                href="#" 
                className="text-slate-300 hover:text-white transition-colors"
              >
                For Employers
              </a>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-4">
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                  userButtonPopoverCard: "bg-slate-800 border-slate-700",
                  userButtonPopoverFooter: "bg-slate-800 border-slate-700"
                }
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}