// Java Spring Patterns Test Fixture
package com.example.demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.stereotype.*;
import javax.persistence.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
    public List<User> getUsers() {
        return new ArrayList<>();
    }
}

@Service
public class UserService {
    public User findById(Long id) {
        return null;
    }
}

@Repository
public class UserRepository {
    public User save(User user) {
        return user;
    }
}

@Entity
@Table(name = "users")
public class User {
    @Id
    private Long id;
    private String name;
    
    public static void main(String[] args) {
        System.out.println("Entry point");
    }
}

