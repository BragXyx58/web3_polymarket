using Microsoft.EntityFrameworkCore;
using System;

namespace CryptoDonateApp.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        
        public DbSet<User> Users { get; set; }
        public DbSet<UserBet> UserBets { get; set; }
    }

    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty; 
    }

    public class UserBet
    {
        public int Id { get; set; }
        public string UserEmail { get; set; } = string.Empty;
        public string MarketId { get; set; } = string.Empty; 
        public string MarketTitle { get; set; } = string.Empty; 
        public string Option { get; set; } = string.Empty; 
        public string Amount { get; set; } = string.Empty;
        public DateTime Date { get; set; } = DateTime.UtcNow; 
    }
}