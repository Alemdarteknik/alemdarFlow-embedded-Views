"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Redirect to systems/all whenever login page is accessed
    router.replace("/systems/all");
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isValidUser = username === "admin" && password === "admin123";

    if (!isValidUser) {
      toast.error("Invalid username or password", {
        description: "Use admin / admin123 to sign in.",
      });
      return;
    }

    sessionStorage.setItem("isAuthenticated", "true");
    router.replace("/systems/all");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-none shadow-none gap-2">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl font-bold text-balance ">
              AlemdAR flow
            </CardTitle>
            <CardDescription className="text-base sr-only">
              Sign in to access your customer dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-muted-foreground">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div> 
              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg">
                Sign In
              </Button>
            </form>
            <CardFooter className="p-2 flex items-center justify-center text-muted-foreground text-sm">
              usr: admin pwd: admin123
            </CardFooter>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative m-2 ml-0 rounded-4xl">
        <Image
          src="/solar-panels-on-rooftop-with-inverters-at-sunset-g.jpg"
          alt="Solar panels and inverters"
          fill
          className="absolute inset-0 w-full h-full object-cover rounded-4xl"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-black/20 rounded-4xl" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h2 className="text-xl font-bold mb-1 text-balance">
            Monitor Your Solar Infrastructure
          </h2>
          <p className="text-lg text-white/90 text-pretty">
            Real-time insights into your customers' solar inverter systems
          </p>
        </div>
      </div>
    </div>
  );
}
