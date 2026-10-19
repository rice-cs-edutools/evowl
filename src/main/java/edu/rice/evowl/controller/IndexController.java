package edu.rice.evowl.controller;

import edu.ksu.lti.launch.model.LtiSession;
import edu.ksu.lti.launch.oauth.LtiPrincipal;
import edu.ksu.lti.launch.service.SimpleLtiLoginService;
import java.util.HashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.ModelAndView;

@Controller
public class IndexController {

    @RequestMapping(value = "/", method = { RequestMethod.GET, RequestMethod.POST })
    public ModelAndView index(@AuthenticationPrincipal LtiPrincipal principal,
                              HttpServletRequest request) {
        Map<String, Object> model = new HashMap<>();

        model.put("userId", principal != null ? principal.getUser() : "guest");

        LtiSession ltiSession = (LtiSession) request.getSession()
                .getAttribute(SimpleLtiLoginService.class.getName());
        if (ltiSession != null && ltiSession.getLtiLaunchData() != null
                && ltiSession.getLtiLaunchData().getRolesList() != null) {
            model.put("roles", ltiSession.getLtiLaunchData().getRolesList().toString());
            System.out.println("Roles: " + model.get("roles"));
        } else {
            model.put("roles", "[]");
        }

        return new ModelAndView("index", model);
    }

    @RequestMapping("/lti/configure")
    public ModelAndView configure(HttpServletRequest request) {
        // Return the LTI XML configuration
        String ltiLaunchUrl = "https://" + request.getServerName() + ":" + request.getServerPort()
                + request.getContextPath() + "/";
        return new ModelAndView("ltiConfigure", "url", ltiLaunchUrl);
    }
}
