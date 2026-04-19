using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CryptoDonateApp.Data;
using System.Threading.Tasks;
using System.Linq;

namespace CryptoDonateApp.Controllers
{
    [ApiController]
    [Route("api")]
    public class PlatformController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PlatformController(AppDbContext context) 
        { 
            _context = context; 
        }

        [HttpPost("auth/register")]
        public async Task<IActionResult> Register([FromBody] User user)
        {
            if (await _context.Users.AnyAsync(u => u.Email == user.Email))
                return BadRequest("Email уже используется");
                
            user.Password = BCrypt.Net.BCrypt.HashPassword(user.Password);
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            
            user.Password = ""; 
            return Ok(user);
        }

        [HttpPost("auth/login")]
        public async Task<IActionResult> Login([FromBody] User loginData)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == loginData.Email);
        
            if (user == null || !BCrypt.Net.BCrypt.Verify(loginData.Password, user.Password)) 
                return Unauthorized("Неверный email или пароль");
                
            user.Password = ""; 
            return Ok(user);
        }

        [HttpPost("user/bets")]
        public async Task<IActionResult> LogBet([FromBody] UserBet bet)
        {
            _context.UserBets.Add(bet);
            await _context.SaveChangesAsync();
            return Ok(bet);
        }

        [HttpGet("user/bets/{email}")]
        public async Task<IActionResult> GetUserBets(string email)
        {
            var bets = await _context.UserBets
                .Where(b => b.UserEmail == email)
                .OrderByDescending(b => b.Date) 
                .ToListAsync();
                
            return Ok(bets);
        }
    }
}